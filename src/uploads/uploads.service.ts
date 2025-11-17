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
  private readonly maxSize: number;

  constructor(
    private configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.profileDir = path.resolve(
      process.cwd(),
      this.configService.get<string>('UPLOAD_PROFILE_DIR', 'uploads/profile'),
    );
    this.maxSize = this.configService.get<number>('UPLOAD_MAX_SIZE', 10 * 1024 * 1024);

    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
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
}
