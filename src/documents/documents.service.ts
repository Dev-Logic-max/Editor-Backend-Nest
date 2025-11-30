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
  ) { }

  async create(userId: string, { title, content }: { title: string; content?: any }): Promise<Doc | null> {
    const user = await this.usersService.findById(userId);
    const document = new this.documentModel({
      title,
      content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
      creator: user._id,
    });
    // return document.save();

    const savedDoc = await document.save();

    return this.documentModel
      .findById(savedDoc._id)
      .populate('creator', 'firstName lastName profilePhoto')
      .populate('collaborators', 'firstName lastName profilePhoto')
      .exec();
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

  async addMediaToDocument(
    userId: string,
    documentId: string,
    media: { filename: string; url: string; type: 'image' | 'video' | 'document' },
  ): Promise<Doc | null> {
    const document = await this.documentModel.findById(documentId).exec();
    if (!document) throw new NotFoundException('Document not found');

    // Check permissions
    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }

    const mediaItem = {
      ...media,
      uploadedAt: new Date(),
    };

    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { $push: { media: mediaItem } },
        { new: true },
      )
      .populate('creator', 'firstName lastName')
      .populate('collaborators', 'firstName lastName')
      .exec();

    return updated;
  }

  async removeMediaFromDocument(
    userId: string,
    documentId: string,
    filename: string,
  ): Promise<Doc | null> {
    const document = await this.documentModel.findById(documentId).exec();
    if (!document) throw new NotFoundException('Document not found');

    // Check permissions
    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { $pull: { media: { filename } } },
        { new: true },
      )
      .populate('creator', 'firstName lastName')
      .populate('collaborators', 'firstName lastName')
      .exec();

    return updated;
  }

  async getDocumentMedia(userId: string, documentId: string): Promise<any[]> {
    const document = await this.documentModel.findById(documentId).exec();
    if (!document) throw new NotFoundException('Document not found');

    // Check permissions
    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }

    return document.media || [];
  }

  async renameMedia(
    userId: string,
    documentId: string,
    filename: string,
    newOriginalName: string,
  ): Promise<Doc | null> {
    const document = await this.documentModel.findById(documentId).exec();
    if (!document) throw new NotFoundException('Document not found');

    if (!document.creator.equals(userId) && !document.collaborators.some((c) => c.equals(userId))) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.documentModel
      .findOneAndUpdate(
        { _id: documentId, 'media.filename': filename },
        { $set: { 'media.$.originalName': newOriginalName } },
        { new: true }
      )
      .populate('creator', 'firstName lastName')
      .populate('collaborators', 'firstName lastName')
      .exec();

    return updated;
  }

  async getAllUserMedia(userId: string): Promise<any[]> {
    const documents = await this.documentModel
      .find({ $or: [{ creator: userId }, { collaborators: userId }] })
      .select('media title')
      .exec();

    const allMedia: any[] = [];

    documents.forEach(doc => {
      if (doc.media && doc.media.length > 0) {
        doc.media.forEach((item: any) => {
          allMedia.push({
            ...item,
            documentId: doc._id,
            documentTitle: doc.title,
          });
        });
      }
    });

    return allMedia;
  }
}
