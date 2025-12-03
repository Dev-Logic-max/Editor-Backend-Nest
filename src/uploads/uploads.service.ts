import * as fs from 'fs';
import * as path from 'path';

import { generateShortId } from 'src/common/utils/generate-id';
import { UsersService } from 'src/users/users.service';

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadsService {
  private readonly profileDir: string;
  private readonly imagesDir: string;
  private readonly maxSize: number;

  constructor(
    private configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    // ✅ Profile directory
    this.profileDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('UPLOAD_PROFILE_DIR', 'uploads/profile'),
    );

    // ✅ Images directory
    this.imagesDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('UPLOAD_IMAGES_DIR', 'uploads/images'),
    );

    this.maxSize = this.configService.get<number>('UPLOAD_MAX_SIZE', 10 * 1024 * 1024);

    // ✅ Create Profile directory
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }

    // ✅ Create images directory
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  private getUniqueFileName(originalName: string): string {
    const ext = path.extname(originalName);
    let id: string;
    let fullPath: string;
    do {
      id = generateShortId(8);
      fullPath = path.join(this.profileDir, `${id}${ext}`);
    } while (fs.existsSync(fullPath));
    return `${id}${ext}`;
  }

  private getUniqueImageFileName(originalName: string): string {
    const ext = path.extname(originalName);
    let id: string;
    let fullPath: string;
    do {
      id = generateShortId(12); // Longer ID for images
      fullPath = path.join(this.imagesDir, `${id}${ext}`);
    } while (fs.existsSync(fullPath));
    return `${id}${ext}`;
  }

  private getUniqueVideoFileName(originalName: string): string {
    const ext = path.extname(originalName);
    let id: string;
    let fullPath: string;
    const videosDir = path.resolve(process.cwd(), 'uploads/videos');

    do {
      id = generateShortId(12);
      fullPath = path.join(videosDir, `${id}${ext}`);
    } while (fs.existsSync(fullPath));

    return `${id}${ext}`;
  }

  private deleteOldFile(fileName: string) {
    if (!fileName) return;
    const oldPath = path.join(this.profileDir, fileName);
    if (fs.existsSync(oldPath)) {
      try {
        fs.unlinkSync(oldPath);
      } catch (e) {
        console.warn('Failed to delete old photo:', e);
      }
    }
  }

  async uploadAndSetProfilePhoto(file: Express.Multer.File, userId: string): Promise<string> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.maxSize) throw new BadRequestException('File too large');

    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Invalid image type');

    // 1. Find user
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 2. Delete old photo
    this.deleteOldFile(user.profilePhoto ?? '');

    // 3. Save new file
    const newFileName = this.getUniqueFileName(file.originalname);
    const targetPath = path.join(this.profileDir, newFileName);

    try {
      fs.writeFileSync(targetPath, file.buffer);
    } catch (err) {
      throw new InternalServerErrorException('Failed to save file', err);
    }

    const fullFileName = newFileName;

    // 4. Update DB
    await this.usersService.setProfilePhoto(userId, fullFileName);

    return fullFileName;
  }

  getProfilePhotoUrl(shortId: string): string {
    if (!shortId) return '';
    const files = fs.readdirSync(this.profileDir);
    const file = files.find((f) => f.startsWith(shortId));
    return file ? `/uploads/profile/${file}` : '';
  }

  async deleteProfilePhoto(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // 1. Delete file from disk
    this.deleteOldFile(user.profilePhoto ?? '');

    // 2. Clear DB field
    await this.usersService.setProfilePhoto(userId, '');
  }

  async uploadImage(file: Express.Multer.File): Promise<{ filename: string; originalName: string; size: number }> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.maxSize) throw new BadRequestException('File too large (max 10MB)');

    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image type. Allowed: JPG, PNG, GIF, WebP');
    }

    // Generate unique filename
    const newFileName = this.getUniqueImageFileName(file.originalname);
    const targetPath = path.join(this.imagesDir, newFileName);

    try {
      fs.writeFileSync(targetPath, file.buffer);
    } catch (err) {
      throw new InternalServerErrorException('Failed to save image', err);
    }

    return {
      filename: newFileName,
      originalName: file.originalname,
      size: file.size, // Add file size in bytes
    };
  }

  async deleteImage(fileName: string): Promise<void> {
    if (!fileName) return;
    const imagePath = path.join(this.imagesDir, fileName);
    if (fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {
        console.warn('Failed to delete image:', e);
      }
    }
  }

  async uploadVideo(file: Express.Multer.File): Promise<{ filename: string; originalName: string; size: number }> {
    if (!file) throw new BadRequestException('No file provided');

    const maxVideoSize = 25 * 1024 * 1024; // 25MB for videos
    if (file.size > maxVideoSize) {
      throw new BadRequestException('Video too large (max 25MB)');
    }

    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Invalid video type. Allowed: MP4, WebM, MOV, AVI');
    }

    // Create videos directory if not exists
    const videosDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('UPLOAD_VIDEOS_DIR', 'uploads/videos'),
    );

    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    const newFileName = this.getUniqueVideoFileName(file.originalname);
    const targetPath = path.join(videosDir, newFileName);

    try {
      fs.writeFileSync(targetPath, file.buffer);
    } catch (err) {
      throw new InternalServerErrorException('Failed to save video', err);
    }

    return {
      filename: newFileName,
      originalName: file.originalname,
      size: file.size,
    };
  }

  async deleteVideo(filename: string): Promise<void> {
    if (!filename) return;
    const videosDir = path.resolve(process.cwd(), 'uploads/videos');
    const videoPath = path.join(videosDir, filename);

    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch (e) {
        console.warn('Failed to delete video:', e);
      }
    }
  }
}
