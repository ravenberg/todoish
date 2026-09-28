import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type AnyRequest, readCookie } from 'nestjs-mvc';
import type { User } from '../database/entities/index.js';
import { ACCESS_TOKEN_COOKIE, AuthService } from './auth.service.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Authenticates every request, public ones included (the landing page knows
 * whether you're logged in), and refuses where the route needs a user.
 * nestjs-mvc turns the 401 into a redirect to /login and back afterwards.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<AnyRequest & { user?: User }>();
    const token = readCookie(req, ACCESS_TOKEN_COOKIE);
    req.user = token
      ? ((await this.auth.userFromToken(token)) ?? undefined)
      : undefined;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;
    if (!req.user) throw new UnauthorizedException();
    return true;
  }
}
