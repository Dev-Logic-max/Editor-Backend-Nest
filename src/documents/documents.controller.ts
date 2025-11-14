import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { DocumentStatus } from 'src/common/enums/docs.enum';
import { UserRole } from 'src/common/enums/roles.enum';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  async create(@Request() req, @Body() body: { title: string; content?: any }) {
    const document = await this.documentsService.create(req.user.id, body);
    return {
      success: true,
      data: document,
      message: 'Document created successfully',
    };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async findAllAdmin(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    const result = await this.documentsService.findAllAdmin(page, limit);
    return {
      success: true,
      data: result.documents,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get()
  async findAll(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.documentsService.findAll(req.user.id, page, limit);
    return {
      success: true,
      data: result.documents,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get(':id')
  async findById(@Request() req, @Param('id') id: string) {
    const document = await this.documentsService.findById(req.user.id, id);
    return {
      success: true,
      data: document,
      message: 'Document retrieved successfully',
    };
  }

  @Put(':id')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body()
    body: { title?: string; content?: any; collaborators?: string[]; status?: DocumentStatus },
  ) {
    const document = await this.documentsService.update(req.user.id, id, body);
    return {
      success: true,
      data: document,
      message: 'Document updated successfully',
    };
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    await this.documentsService.delete(req.user.id, id);
    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }
}
