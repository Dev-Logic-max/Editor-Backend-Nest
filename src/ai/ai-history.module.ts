// src/ai-history/ai-history.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AIHistory, AIHistorySchema } from './schemas/ai-history.schema';
import { AIHistoryService } from './ai-history.service';
import { AIHistoryController } from './ai-history.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AIHistory.name, schema: AIHistorySchema }]),
  ],
  controllers: [AIHistoryController],
  providers: [AIHistoryService],
  exports: [AIHistoryService],
})
export class AIHistoryModule {}