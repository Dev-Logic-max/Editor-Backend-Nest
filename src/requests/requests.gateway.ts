import { Server, Socket } from 'socket.io';

import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';
import { UsersService } from '../users/users.service';

@WebSocketGateway({ cors: true })
export class RequestsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server; // Inject server with decorator

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
  ) {}

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinNotifications')
  handleJoin(@MessageBody() userId: string, @ConnectedSocket() client: Socket) {
    client.join(`user_${userId}`);
  }

  sendInvite(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('newInvite', data);
  }

  sendAccepted(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('inviteAccepted', data);
  }

  sendRejected(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('inviteRejected', data);
  }

  handleConnection(client: Socket) {
    // Optional: Log connection
  }

  handleDisconnect(client: Socket) {
    // Optional: Log disconnection
  }
}
