import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MvcModule } from 'nestjs-mvc';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import type { User } from './database/entities/index.js';
import { DomainModule } from './domain.module.js';
import { FeaturesModule } from './features.module.js';
import { PrivacyInterceptor } from './privacy.interceptor.js';
import { SharedDataMiddleware } from './shared-data.middleware.js';
import { template } from './template.js';
import { XrayModule } from './xray/xray.module.js';

/**
 * What nestjs-mvc signs with: flash cookies, signed URLs. APP_KEY in
 * production; a fixed key in development, so a restart of `nest start
 * --watch` does not break the invitation links already handed out.
 */
function signingKeys() {
  if (process.env.APP_KEY || process.env.NODE_ENV === 'production')
    return undefined; // nestjs-mvc reads APP_KEY, and insists on it in production.
  return 'todoish-development-only-signing-key';
}

@Module({
  imports: [
    DatabaseModule,
    DomainModule,
    AuthModule,
    FeaturesModule,
    MvcModule.forRoot({
      template,
      keys: signingKeys(),
      version: process.env.GIT_COMMIT,
      // Vite runs inside this process in development; production resolves the
      // hashed assets from the build manifest.
      vite: {},
      // The logged-in user on every page as `auth.user`: only these fields.
      auth: {
        share: (user: User) => ({
          id: user.id,
          name: user.name,
          email: user.email,
        }),
      },
      errorPages: ({ status, exception }) =>
        [403, 404, 500, 503].includes(status)
          ? {
              component: 'Errors/Show',
              props: {
                status,
                // Ours to show for a 403 or 404; a 500's message is internal.
                reason: status < 500 ? (exception as Error).message : undefined,
              },
              shared: true,
            }
          : undefined,
    }),
    // After MvcModule: its interceptor has to see props before they resolve.
    XrayModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: PrivacyInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SharedDataMiddleware).forRoutes('{*path}');
  }
}
