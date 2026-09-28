import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AnyRequest,
  type AnyResponse,
  Ssr,
  ValidSignature,
  View,
  ViewService,
  requestUrl,
} from 'nestjs-mvc';
import { IsNull, Repository } from 'typeorm';
import { AccountsService } from '../auth/accounts.service.js';
import { registerSchema } from '../auth/auth.schemas.js';
import { AuthService } from '../auth/auth.service.js';
import { Public } from '../auth/public.decorator.js';
import { validateWith } from '../common/validate.js';
import {
  Activity,
  Invitation,
  ProjectMember,
  Task,
  type User,
} from '../database/entities/index.js';
import { ProjectsService } from '../projects/projects.service.js';

/**
 * Where an invitation link lands. No login needed: the signature is the
 * proof. @ValidSignature() turns away a link that was changed or has expired
 * (a 403, shown as the error page), and the handler refuses one that was
 * used already, so every link works once.
 *
 * It's server-rendered (@Ssr()), because this is the link people paste into
 * a chat: the preview and the first paint come straight from the server.
 */
@Public()
@ValidSignature()
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly accounts: AccountsService,
    private readonly auth: AuthService,
    private readonly view: ViewService,
    @InjectRepository(Invitation)
    private readonly invitations: Repository<Invitation>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(Activity)
    private readonly activity: Repository<Activity>,
  ) {}

  @Get(':id')
  @Ssr()
  @View('Invitations/Show')
  async show(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AnyRequest & { user?: User },
  ) {
    const invitation = await this.open(id);
    const project = invitation.project;
    const user = req.user;
    return {
      project: { id: project.id, name: project.name, color: project.color },
      invitedBy: {
        id: invitation.invitedBy.id,
        name: invitation.invitedBy.name,
      },
      people: await this.projects.people(project.id),
      openTasks: await this.tasks.count({
        where: { project: { id: project.id }, completedAt: IsNull() },
      }),
      alreadyMember: user
        ? await this.projects.isMember(project.id, user.id)
        : false,
      // The form posts back to this same signed URL.
      action: requestUrl(req),
    };
  }

  /** Logged in: join. A guest signs up on the spot, then joins. */
  @Post(':id')
  async accept(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AnyRequest & { user?: User },
    @Res({ passthrough: true }) res: AnyResponse,
  ) {
    const invitation = await this.open(id);
    let user = req.user;
    if (!user) {
      const input = await validateWith(
        registerSchema((email) => this.accounts.emailTaken(email)),
        body,
      );
      user = await this.accounts.register(input);
      await this.auth.signIn(res, user);
    }
    const project = invitation.project;
    if (!(await this.projects.isMember(project.id, user.id))) {
      await this.members.save(this.members.create({ project, user }));
      await this.activity.save({
        kind: 'joined',
        actor: user,
        project,
        taskTitle: '',
      });
    }
    await this.invitations.update(invitation.id, { acceptedAt: new Date() });
    this.view.refresh('sidebar');
    return this.view
      .flash('success', `You’re in “${project.name}”. Say hi.`)
      .redirect(`/projects/${project.id}`);
  }

  private async open(id: number) {
    const invitation = await this.invitations.findOneBy({ id });
    if (!invitation) throw new NotFoundException('That invitation is gone.');
    if (invitation.acceptedAt)
      throw new ForbiddenException(
        'This invitation has been used. Ask for a new link; they’re free.',
      );
    return invitation;
  }
}
