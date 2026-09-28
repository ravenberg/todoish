import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

const app = configureApp(
  await NestFactory.create<NestExpressApplication>(AppModule),
);
// The manifest, the icons and the service worker. The worker has to be
// served from the root to control the whole app.
app.useStaticAssets(join(process.cwd(), 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
  },
});
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  app.useStaticAssets(join(process.cwd(), 'dist/client'), {
    prefix: '/build/',
    immutable: true,
    maxAge: '1y',
  });
}
await app.listen(process.env.PORT ?? 3000);
