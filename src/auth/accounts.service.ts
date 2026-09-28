import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Project, ProjectMember, User } from '../database/entities/index.js';
import { hashPassword } from './passwords.js';

/** The secret in an email-to-inbox address: long enough not to guess. */
export const newInboxToken = () => randomBytes(9).toString('base64url');

/** Signing up: a user, their Inbox, and they're a member of it. */
@Injectable()
export class AccountsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  emailTaken(email: string) {
    return this.db
      .getRepository(User)
      .existsBy({ email: email.trim().toLowerCase() });
  }

  async register(input: { name: string; email: string; password: string }) {
    return this.db.transaction(async (db) => {
      const user = await db.getRepository(User).save(
        db.getRepository(User).create({
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          passwordHash: await hashPassword(input.password),
          inboxToken: newInboxToken(),
        }),
      );
      const inbox = await db
        .getRepository(Project)
        .save(
          db
            .getRepository(Project)
            .create({ name: 'Inbox', isInbox: true, owner: user }),
        );
      await db
        .getRepository(ProjectMember)
        .save(db.getRepository(ProjectMember).create({ project: inbox, user }));
      return user;
    });
  }
}
