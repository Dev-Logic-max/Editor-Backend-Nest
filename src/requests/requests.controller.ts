import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';

import { RequestsService } from './requests.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('requests')
@UseGuards(JwtAuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('invite')
  async sendInvite(
    @Request() req,
    @Body() body: { receiverEmail: string; documentId: string; message?: string },
  ) {
    const request = await this.requestsService.create(req.user.id, body);
    return { success: true, data: request, message: 'Invite sent' };
  }

  @Post(':id/accept')
  async accept(@Request() req, @Param('id') id: string) {
    const request = await this.requestsService.accept(id, req.user.id);
    return { success: true, data: request, message: 'Invite accepted' };
  }

  @Post(':id/reject')
  async reject(@Request() req, @Param('id') id: string) {
    const request = await this.requestsService.reject(id, req.user.id);
    return { success: true, data: request, message: 'Invite rejected' };
  }

  @Post('pending')
  async getPending(@Request() req) {
    const requests = await this.requestsService.findPendingByUser(req.user.id);
    return { success: true, data: requests };
  }
}
