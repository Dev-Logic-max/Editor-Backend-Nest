import { DocumentsModule } from 'src/documents/documents.module';
import { UsersModule } from 'src/users/users.module';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [ConfigModule, UsersModule, DocumentsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
