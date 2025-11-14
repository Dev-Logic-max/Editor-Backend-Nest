import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { RequestsController } from './requests.controller';
import { RequestsGateway } from './requests.gateway'; // New gateway
import { RequestsService } from './requests.service';
import { Request, RequestSchema } from './schemas/requests.schema';

import { DocumentsModule } from '../documents/documents.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Request.name, schema: RequestSchema }]),
    UsersModule,
    DocumentsModule,
    ConfigModule, // Required for JwtModule
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestsGateway],
  exports: [RequestsService],
})
export class RequestsModule {}
