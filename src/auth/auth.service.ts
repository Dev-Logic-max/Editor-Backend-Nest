import * as bcrypt from 'bcrypt';

import { UserRole } from 'src/common/enums/roles.enum';
import { CreateUserDto } from 'src/users/data/create-user.dto';
import { User } from 'src/users/schemas/users.schema';

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private getSafeUser(user: User) {
    const { password, resetToken, ...safeUser } = user.toObject();
    return safeUser; // Returns all fields except password/resetToken
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      return this.getSafeUser(user);
    }
    return null;
  }

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto, UserRole.USER);
    const payload = { sub: user._id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: this.getSafeUser(user),
    };
  }

  async login({ email, password }: { email: string; password: string }) {
    const user = await this.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const payload = { sub: user._id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user,
    };
  }

  async verify(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      return this.getSafeUser(user);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findById(payload.sub);
      const safeUser = this.getSafeUser(user);
      const newPayload = { sub: user._id, role: user.role };
      return {
        access_token: this.jwtService.sign(newPayload),
        refresh_token: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
        user: safeUser,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async changePassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      if (user.resetToken !== token) {
        throw new BadRequestException('Invalid reset token');
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await this.usersService.update(String(user._id), {
        password: hashedPassword,
        resetToken: undefined,
      });
      return this.getSafeUser(updatedUser);
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    const payload = { sub: user._id };
    const resetToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    await this.usersService.update(String(user._id), { resetToken });
    // In production, send resetToken via email (e.g., Nodemailer)
    return { resetToken }; // For testing; replace with email logic
  }

  async logout() {
    return { success: true, message: 'Logged out' };
  }
}
