// src/ai-history/ai-history.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AIHistory } from './schemas/ai-history.schema';

@Injectable()
export class AIHistoryService {
  constructor(@InjectModel(AIHistory.name) private model: Model<AIHistory>) {}

  async create(data: {
    userId: string;
    documentId: string;
    action: string;
    original: string;
    improved: string;
    model: string;
  }) {
    const created = new this.model({ ...data, status: 'pending' });
    return created.save();
  }

  async getByDocument(documentId: string, userId: string) {
    return this.model
      .find({ documentId, userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async updateStatus(id: string, status: 'accepted' | 'rejected') {
    return this.model.findByIdAndUpdate(id, { status }, { new: true });
  }
}