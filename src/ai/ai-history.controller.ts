// src/ai-history/ai-history.controller.ts
import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AIHistoryService } from './ai-history.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('ai-history')
@UseGuards(JwtAuthGuard)
export class AIHistoryController {
  constructor(private readonly aiHistoryService: AIHistoryService) {}

  // GET /ai-history?documentId=xxx → Load all history for this document + user
  @Get()
  async getByDocument(
    @Query('documentId') documentId: string,
    @Req() req: any,
  ) {
    const userId = req.user.sub; // from JWT
    const history = await this.aiHistoryService.getByDocument(documentId, userId);
    return {
      success: true,
      data: { history },
    };
  }

  // POST /ai-history/:id/accept
  @Post(':id/accept')
  async accept(@Param('id') id: string) {
    const updated = await this.aiHistoryService.updateStatus(id, 'accepted');
    return {
      success: true,
      data: updated,
      message: 'Suggestion accepted',
    };
  }

  // POST /ai-history/:id/reject
  @Post(':id/reject')
  async reject(@Param('id') id: string) {
    const updated = await this.aiHistoryService.updateStatus(id, 'rejected');
    return {
      success: true,
      data: updated,
      message: 'Suggestion rejected',
    };
  }
}