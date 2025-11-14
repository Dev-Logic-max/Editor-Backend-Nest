import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { UserRole } from 'src/common/enums/roles.enum';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { CreateUserDto } from './data/create-user.dto';
import { UpdateUserDto } from './data/update-user.dto';
import { User } from './schemas/users.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto, role: UserRole = UserRole.USER): Promise<User> {
    const { email, password } = createUserDto;
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) throw new BadRequestException('Email already exists');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({ ...createUserDto, password: hashedPassword, role });
    return user.save();
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const users = await this.userModel
      .find({ isActive: true })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .exec();
    const total = await this.userModel.countDocuments({ isActive: true }).exec();
    return { users, total, page, limit };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setProfilePhoto(userId: string, shortId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { profilePhoto: shortId }, { new: true })
      .select('-password')
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async delete(id: string): Promise<User> {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async addConnection(userId: string, connectionId: string): Promise<User> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $addToSet: { connections: connectionId } }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
