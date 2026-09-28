import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type AnyRequest, requestState } from 'nestjs-mvc';
import type { Observable } from 'rxjs';
import type { User } from './database/entities/index.js';

/**
 * "Encrypt history" in Settings, for shared computers: every page this user
 * sees is stored encrypted in browser history, and logging out (which
 * clears history) makes the back button show nothing. A runtime choice per
 * user, so it's set per request, where `@EncryptHistory()` is per route.
 * Runs after the guards, which is where the user is known.
 */
@Injectable()
export class PrivacyInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const req = context
        .switchToHttp()
        .getRequest<AnyRequest & { user?: User }>();
      if (req.user?.encryptHistory) requestState(req).encryptHistory = true;
    }
    return next.handle();
  }
}
