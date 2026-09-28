// Brings in multer's Express.Multer.File type.
import type {} from 'multer';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { ValidationException, ViewService } from 'nestjs-mvc';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { FilePipe, MAX_BYTES } from '../common/file.pipe.js';
import { Comment, type User } from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';
import { CommentSchema } from '../tasks/tasks.schemas.js';
import { TasksService } from '../tasks/tasks.service.js';

export const storage = () => process.env.STORAGE_PATH ?? 'storage';

@Controller()
export class CommentsController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly view: ViewService,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
  ) {}

  /**
   * A comment, with or without a file. One multipart form post from the
   * same useForm as any other: the file is read into memory (capped well
   * above the real limit), checked by FilePipe, and only then written.
   */
  @Post('tasks/:id/comments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_BYTES * 2, files: 1 } }),
  )
  async create(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body({ schema: CommentSchema }) body: z.infer<typeof CommentSchema>,
    @UploadedFile(new FilePipe({ optional: true }))
    file: Express.Multer.File | undefined,
  ) {
    const task = await this.tasks.find(id, user);
    if (!body.body && !file)
      throw new ValidationException({
        body: 'Write something, or add a file.',
      });

    let stored: Partial<Comment> = {};
    if (file) {
      const storageKey = join('comments', String(task.id), randomUUID());
      await mkdir(join(storage(), 'comments', String(task.id)), {
        recursive: true,
      });
      await writeFile(join(storage(), storageKey), file.buffer);
      stored = {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
      };
    }
    await this.comments.save(
      this.comments.create({ body: body.body, task, author: user, ...stored }),
    );
    await this.tasks.log('commented', user, task);
    await this.tasks.touch(task);
    return this.view.back();
  }

  /** The file itself: a plain download, for whoever may see the task. */
  @Get('comments/:id/file')
  async download(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const comment = await this.find(id, user);
    if (!comment.storageKey) throw new NotFoundException('No file here.');
    const inline = comment.mimeType!.startsWith('image/');
    return new StreamableFile(
      createReadStream(join(storage(), comment.storageKey)),
      {
        type: comment.mimeType!,
        length: comment.size!,
        disposition: `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(comment.filename!)}"`,
      },
    );
  }

  @Delete('comments/:id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const comment = await this.find(id, user);
    if (comment.author?.id !== user.id)
      throw new ForbiddenException('That’s someone else’s comment.');
    await this.comments.remove(comment);
    await this.tasks.touch(comment.task);
    if (comment.storageKey)
      await rm(join(storage(), comment.storageKey), { force: true });
    return this.view.back();
  }

  private async find(id: number, user: User) {
    const comment = await this.comments.findOne({
      where: { id },
      relations: { task: { project: true } },
      withDeleted: true,
    });
    if (!comment) throw new NotFoundException('That comment is gone.');
    if (!(await this.projects.isMember(comment.task.project.id, user.id)))
      throw new ForbiddenException(
        'That comment is in someone else’s project.',
      );
    return comment;
  }
}
