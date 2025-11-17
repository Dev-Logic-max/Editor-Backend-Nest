import { Request } from 'express';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

import {
  BadRequestException,
  Controller,
  Delete,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { UploadsService } from './uploads.service';

interface AuthRequest extends Request {
  user: { id: string }; // from JWT payload
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfile(@UploadedFile() file: Express.Multer.File, @Req() req: AuthRequest) {
    if (!file) throw new BadRequestException('File is required');

    const shortId = await this.uploadsService.uploadAndSetProfilePhoto(file, req.user.id);

    return { success: true, data: { profilePhoto: shortId }, message: 'Profile photo uploaded' };
  }

  @Delete('profile')
  @UseGuards(JwtAuthGuard)
  async deleteProfile(@Req() req: AuthRequest) {
    await this.uploadsService.deleteProfilePhoto(req.user.id);
    return {
      success: true,
      message: 'Profile photo removed',
    };
  }
}
