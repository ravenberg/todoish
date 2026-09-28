import { createHmac } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

/**
 * The login token is signed with a key derived from APP_KEY, so the app has
 * one secret. In development a fixed value keeps you logged in across
 * restarts; nestjs-mvc refuses to start in production without APP_KEY.
 */
function jwtSecret(): string {
  const appKey = process.env.APP_KEY;
  if (appKey)
    return createHmac('sha256', appKey)
      .update('todoish:jwt')
      .digest('base64url');
  if (process.env.NODE_ENV === 'production')
    throw new Error('Set APP_KEY to start Todoish in production.');
  return 'todoish-development-only';
}

@Module({
  imports: [JwtModule.register({ secret: jwtSecret() })],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountsService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, AccountsService],
})
export class AuthModule {}
