import 'reflect-metadata';
import { loadRootEnv } from '@bhoomisetu/db';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './common/context/request-context';
import { env } from './config/env';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const config = env();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // The portal proxies /api/* from the same machine; trust its X-Forwarded-For for audit IPs.
  app.set('trust proxy', 'loopback');
  app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false }));
  app.use(cookieParser());
  app.use(requestContextMiddleware);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: [config.PORTAL_URL, config.FIELD_URL], credentials: true });
  app.enableShutdownHooks();

  if (config.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('BhoomiSetu API').setVersion('v1').build());
    SwaggerModule.setup('api/docs', app, doc);
  }

  await app.listen(config.API_PORT);
  console.log(`api listening on :${config.API_PORT}${config.DEMO_NOW ? ` — clock frozen at ${config.DEMO_NOW}` : ''}`);
}

void bootstrap();
