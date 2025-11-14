import { Model } from 'mongoose';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { RequestsGateway } from './requests.gateway';
import { Request } from './schemas/requests.schema';

import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RequestsService {
  constructor(
    @InjectModel(Request.name) private requestModel: Model<Request>,
    private usersService: UsersService,
    private documentsService: DocumentsService,
    private requestsGateway: RequestsGateway,
  ) {}

  async create(
    senderId: string,
    {
      receiverEmail,
      documentId,
      message,
    }: { receiverEmail: string; documentId: string; message?: string },
  ) {
    const sender = await this.usersService.findById(senderId);
    const receiver = await this.usersService.findByEmail(receiverEmail); // Validate email exists
    const document = await this.documentsService.findById(senderId, documentId); // Ensure sender is creator

    const existing = await this.requestModel.findOne({
      sender: senderId,
      receiver: receiver._id,
      document: documentId,
    });
    if (existing) throw new BadRequestException('Request already sent');

    const request = new this.requestModel({
      sender: sender._id,
      receiver: receiver._id,
      document: document._id,
      message,
    });
    await request.save();

    // Notify receiver via Socket.io
    this.requestsGateway.sendInvite(String(receiver._id), {
      requestId: request._id,
      senderName: sender.firstName,
      documentTitle: document.title,
    });
    return request;
  }

  async accept(requestId: string, receiverId: string) {
    console.log('Accepting request:', { requestId, receiverId }); // Debug
    const request = await this.requestModel.findById(requestId).populate('sender document').exec();
    if (!request) {
      console.log('Request not found for ID:', requestId);
      throw new NotFoundException('Request not found');
    }
    if (request.receiver.toString() !== receiverId.toString()) {
      console.log('Receiver mismatch:', {
        expected: request.receiver.toString(),
        received: receiverId,
      });
      throw new NotFoundException('Request not match');
    }
    if (request.status !== 'pending') {
      console.log('Request already handled:', request.status);
      throw new BadRequestException('Request already handled');
    }

    request.status = 'accepted';
    await request.save();

    // Add to collaborators
    await this.documentsService.update(
      request.sender._id.toString(),
      request.document._id.toString(),
      {
        $addToSet: { collaborators: receiverId },
      },
    );

    // Notify sender
    this.requestsGateway.sendAccepted(request.sender._id.toString(), {
      requestId,
      receiverName: (await this.usersService.findById(receiverId)).firstName,
    });
    return request;
  }

  async reject(requestId: string, receiverId: string) {
    const request = await this.requestModel.findById(requestId);
    if (!request || request.receiver.toString() !== receiverId)
      throw new NotFoundException('Request not found');

    request.status = 'rejected';
    await request.save();

    // Optional: Notify sender
    this.requestsGateway.sendRejected(request.sender._id.toString(), { requestId });
    return request;
  }

  async findPendingByUser(userId: string) {
    return this.requestModel
      .find({ receiver: userId, status: 'pending' })
      .populate('sender document')
      .exec();
  }
}
