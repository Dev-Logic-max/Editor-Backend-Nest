import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HocuspocusModule } from './hocuspocus/hocuspocus.module';
import { RequestsModule } from './requests/requests.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { AIHistoryModule } from './ai/ai-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // 🔐 Load .env globally

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const atlasUri = configService.get<string>('MONGODB_ATLAS_URI');
        const localUri = configService.get<string>('MONGODB_URI');
        const dbName = configService.get<string>('DATABASE_NAME') || 'editor';

        const uri = atlasUri && atlasUri.length > 0 ? atlasUri : `${localUri}/${dbName}`;

        // uri: `${configService.get('MONGODB_URI')}/${configService.get('DATABASE_NAME')}`

        return {
          uri,
          connectionFactory: (connection) => {
            connection.on('connected', () => console.log('✅ MongoDB connected successfully!'));
            connection.on('disconnected', () => console.log('⚠️  MongoDB disconnected  '));
            connection.on('error', (err: Error) => console.error('❌ MongoDB connection error:', err));
            return connection;
          },
        }
      },
      inject: [ConfigService],
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: configService.get('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),

    AuthModule,
    UsersModule,
    UploadsModule,
    DatabaseModule,
    DocumentsModule,
    HocuspocusModule,
    RequestsModule,
    AIHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
