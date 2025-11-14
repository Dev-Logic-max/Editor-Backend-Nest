import { CreateUserDto } from 'src/users/data/create-user.dto';

import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register') // 📝 Register new user (default role: USER)
  async register(@Body() createUserDto: CreateUserDto) {
    const result = await this.authService.register(createUserDto);
    return { success: true, data: result, message: 'Registration successful 🎉' };
  }

  @UseGuards(LocalAuthGuard)
  @Post('login') // 🔑 Login with email/password
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.authService.login(body);
    return { success: true, data: result, message: 'Login successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify') // ✅ Verify JWT token
  async verify(@Body('token') token: string) {
    const result = await this.authService.verify(token);
    return { success: true, data: result, message: 'Token verified successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh') // 🔄 Refresh JWT token
  async refresh(@Body('refresh_token') refreshToken: string) {
    const result = await this.authService.refresh(refreshToken);
    return { success: true, data: result, message: 'Token refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password') // 🔒 Change password with resset token
  async changePassword(@Body() body: { token: string; newPassword: string }) {
    const result = await this.authService.changePassword(body.token, body.newPassword);
    return { success: true, data: result, message: 'Password reset successfully' };
  }

  @Post('forgot-password') // 📧 Forgot password (placeholder for email reset)
  async forgotPassword(@Body('email') email: string) {
    const result = await this.authService.forgotPassword(email);
    return { success: true, data: result, message: 'Password reset token generated' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout') // 🚪 Logout (client-side token discard)
  logout() {
    return this.authService.logout();
  }
}
