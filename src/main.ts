import * as path from 'path';
import * as express from 'express';
import * as bodyParser from 'body-parser';

import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get('PORT') || 3033;

  // ------ Increase payload limit ------ //
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // --------------- CORS --------------- //
  app.enableCors({
    origin: [
      'http://localhost:3000',
      configService.get('FRONTEND_ORIGIN'),
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  }); // ✨ Enable CORS for frontend 🎨

  // ---------- SERVE UPLOADED FILES ---------- //
  const uploadDir = path.resolve(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadDir));

  // ---------- LISTEN ---------- //
  await app.listen(port);

  console.log('✨ ============================================== ✨');
  console.log(`🚀 Backend is running on http://localhost:${port} 🚀`);
}
bootstrap();
