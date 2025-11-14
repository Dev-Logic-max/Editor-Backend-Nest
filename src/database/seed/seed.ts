import { NestFactory } from '@nestjs/core';

import { AppModule } from '../../app.module';
import { UserRole } from '../../common/enums/roles.enum';
import { UsersService } from '../../users/users.service';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const usersService = app.get(UsersService);

    await usersService.create({
      firstName: 'John',
      lastName: 'Doe',
      email: 'admin@example.com',
      password: 'Admin@123',
      role: UserRole.ADMIN,
    });

    await usersService.create({
      firstName: 'Alex',
      lastName: 'Peter',
      email: 'user@example.com',
      password: 'user',
      role: UserRole.USER,
    });

    console.log('✅ Seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

seed();
