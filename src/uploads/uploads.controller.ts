import { Request } from 'express';

import { UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException, Controller, Delete, Param, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UploadsService } from 'src/uploads/uploads.service';

interface AuthRequest extends Request {
  user: { id: string }; // from JWT payload
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) { }

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

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    const { filename, originalName, size } = await this.uploadsService.uploadImage(file);
    return {
      success: true,
      filename,
      originalName,
      size,
      url: `/uploads/images/${filename}`,
      message: 'Image uploaded successfully',
    };
  }

  @Delete('image/:filename')
  @UseGuards(JwtAuthGuard)
  async deleteImage(@Param('filename') filename: string) {
    await this.uploadsService.deleteImage(filename);
    return {
      success: true,
      message: 'Image deleted successfully',
    };
  }

  @Post('video')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    const { filename, originalName, size } = await this.uploadsService.uploadVideo(file);
    return {
      success: true,
      filename,
      originalName,
      size,
      url: `/uploads/videos/${filename}`,
      message: 'Video uploaded successfully',
    };
  }

  @Delete('video/:filename')
  @UseGuards(JwtAuthGuard)
  async deleteVideo(@Param('filename') filename: string) {
    await this.uploadsService.deleteVideo(filename);
    return {
      success: true,
      message: 'Video deleted successfully',
    };
  }
}
