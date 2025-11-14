import { Model } from 'mongoose';

import { DocumentStatus } from 'src/common/enums/docs.enum';
import { UsersService } from 'src/users/users.service';

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Doc } from './schemas/documents.schema';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Doc.name) private documentModel: Model<Doc>,
    private usersService: UsersService,
  ) {}

  async create(userId: string, { title, content }: { title: string; content?: any }): Promise<Doc> {
    const user = await this.usersService.findById(userId);
    const document = new this.documentModel({
      title,
      content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
      creator: user._id,
    });
    return document.save();
  }

  async findAllAdmin(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ documents: Doc[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const documents = await this.documentModel
      .find()
      .populate('creator', 'firstName lastName profilePhoto')
      .populate('collaborators', 'firstName lastName profilePhoto')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
    const total = await this.documentModel.countDocuments().exec();
    return { documents, total, page, limit };
  }

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ documents: Doc[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const documents = await this.documentModel
      .find({ $or: [{ creator: userId }, { collaborators: userId }] })
      .populate('creator', 'firstName lastName profilePhoto')
      .populate('collaborators', 'firstName lastName profilePhoto')
      .skip(skip)
      .limit(limit)
      .exec();
    const total = await this.documentModel
      .countDocuments({ $or: [{ creator: userId }, { collaborators: userId }] })
      .exec();
    return { documents, total, page, limit };
  }

  async findById(userId: string, id: string): Promise<Doc> {
    // const document = await this.documentModel.findById(id).exec();
    const document = await this.documentModel
      .findById(id)
      .populate('creator', 'firstName lastName') // Populate creator
      .populate('collaborators', 'firstName lastName') // Populate collaborators
      .exec();
    if (!document) throw new NotFoundException('Document not found');
    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }
    return document;
  }

  async update(
    userId: string,
    id: string,
    update: {
      title?: string;
      content?: any;
      collaborators?: string[];
      status?: DocumentStatus;
      $addToSet?: { collaborators: string };
    },
  ): Promise<Doc | null> {
    const document = await this.documentModel.findById(id).exec();
    if (!document) throw new NotFoundException('Document not found');
    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }
    // Validate collaborator IDs
    // if (update.collaborators) {
    //     for (const collaboratorId of update.collaborators) {
    //         await this.usersService.findById(collaboratorId);
    //     }
    // }

    // Validate collaborator IDs if present
    if ('collaborators' in update && Array.isArray(update.collaborators)) {
      for (const collaboratorId of update.collaborators) {
        await this.usersService.findById(collaboratorId);
      }
    }

    if ('$addToSet' in update && update.$addToSet?.collaborators) {
      await this.usersService.findById(update.$addToSet.collaborators);
    }

    const updated = await this.documentModel
      .findByIdAndUpdate(id, update, { new: true })
      .populate('creator', 'firstName lastName')
      .populate('collaborators', 'firstName lastName')
      .exec();
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const document = await this.documentModel.findById(id).exec();
    if (!document) throw new NotFoundException('Document not found');
    if (!document.creator.equals(userId)) {
      throw new ForbiddenException('Only the creator can delete this document');
    }
    await this.documentModel.findByIdAndDelete(id).exec();
  }
}
