import { RolesGuard } from 'src/auth/guards/roles.guard';

import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { CreateUserDto } from './data/create-user.dto';
import { UpdateUserDto } from './data/update-user.dto';
import { UsersService } from './users.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('create')
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { success: true, data: user, message: 'User created successfully' };
  }

  @Get() // 📋 Get all users (admin-only, for management)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    const result = await this.usersService.findAll(page, limit);
    return {
      success: true,
      data: result.users,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get(':id') // 👤 Get single user by ID
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, data: user, message: 'User retrieved successfully' };
  }

  @Put(':id') // ✏️ Update user
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);
    return { success: true, data: user, message: 'User updated successfully' };
  }

  @Delete(':id') // 🗑️ Delete user
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    await this.usersService.delete(id);
    return { success: true, message: 'User deleted successfully' };
  }

  @Post(':id/connections/:connectionId') // 🤝 Add connection (collaborator)
  async addConnection(@Param('id') id: string, @Param('connectionId') connectionId: string) {
    return this.usersService.addConnection(id, connectionId);
  }
}
