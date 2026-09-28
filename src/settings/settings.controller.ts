import { Body, Controller, Get, Post, Put, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  type AnyRequest,
  SignedUrls,
  ValidationException,
  View,
  ViewService,
  requestOrigin,
} from 'nestjs-mvc';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { newInboxToken } from '../auth/accounts.service.js';
import { PasswordSchema } from '../auth/auth.schemas.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { User } from '../database/entities/index.js';

const ProfileSchema = z.object({
  name: z.string().trim().min(1, 'What should we call you?').max(80),
  email: z
    .email('That doesn’t look like an email address.')
    .trim()
    .toLowerCase(),
});

const ChangePasswordSchema = z.object({
  current: z.string().min(1, 'Your current password, please.'),
  password: PasswordSchema,
});

const PrivacySchema = z.object({ encryptHistory: z.boolean() });

/**
 * Settings: two forms on one page (profile and password) each post with
 * their own error bag, so a mistake in one never shows up in the other.
 */
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly view: ViewService,
    private readonly links: SignedUrls,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get()
  @View('Settings/Index')
  index(@CurrentUser() user: User, @Req() req: AnyRequest) {
    const origin = requestOrigin(req) ?? '';
    return {
      profile: { name: user.name, email: user.email },
      privacy: { encryptHistory: user.encryptHistory },
      integrations: {
        // Signed and without expiry: a calendar app keeps it for years.
        // Resetting bumps calendarVersion, and the old link stops working.
        calendarUrl:
          origin +
          this.links.sign(`/calendar/${user.id}.ics?v=${user.calendarVersion}`),
        inboxAddress: `inbox+${user.inboxToken}@todoish.dev`,
        hookUrl: `${origin}/hooks/inbox/${user.inboxToken}`,
      },
    };
  }

  @Put('profile')
  async profile(
    @CurrentUser() user: User,
    @Body({ schema: ProfileSchema }) body: z.infer<typeof ProfileSchema>,
  ) {
    const taken = await this.users.findOneBy({ email: body.email });
    if (taken && taken.id !== user.id)
      throw new ValidationException({
        email: 'Someone else uses that address.',
      });
    await this.users.update(user.id, body);
    return this.view.flash('success', 'Profile saved.').back();
  }

  @Put('password')
  async password(
    @CurrentUser() user: User,
    @Body({ schema: ChangePasswordSchema })
    body: z.infer<typeof ChangePasswordSchema>,
  ) {
    const stored = await this.users.findOne({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!(await verifyPassword(body.current, stored?.passwordHash)))
      throw new ValidationException({
        current: 'That isn’t your current password.',
      });
    await this.users.update(user.id, {
      passwordHash: await hashPassword(body.password),
    });
    return this.view.flash('success', 'Password changed.').back();
  }

  @Put('privacy')
  async privacy(
    @CurrentUser() user: User,
    @Body({ schema: PrivacySchema }) body: z.infer<typeof PrivacySchema>,
  ) {
    await this.users.update(user.id, body);
    return this.view
      .flash(
        'success',
        body.encryptHistory
          ? 'History encryption is on: the back button shows nothing once you log out.'
          : 'History encryption is off.',
      )
      .back();
  }

  @Post('calendar/reset')
  async resetCalendar(@CurrentUser() user: User) {
    await this.users.increment({ id: user.id }, 'calendarVersion', 1);
    return this.view
      .flash('success', 'New calendar link. The old one no longer works.')
      .back();
  }

  @Post('inbox/reset')
  async resetInbox(@CurrentUser() user: User) {
    await this.users.update(user.id, { inboxToken: newInboxToken() });
    return this.view
      .flash('success', 'New inbox address. The old one no longer works.')
      .back();
  }
}
