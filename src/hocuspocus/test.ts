import * as Y from 'yjs';

import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { DocumentsService } from '../documents/documents.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class HocuspocusService implements OnModuleInit {
  private readonly logger = new Logger(HocuspocusService.name);
  private server: Server;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private documentsService: DocumentsService,
    private usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.startServer();
  }

  private async startServer() {
    this.server = new Server({
      port: this.configService.get('HOCUSPOCUS_PORT', 1234),
      debounce: 3000,
      maxDebounce: 10000,
      name: 'AI-Editor-Collab',
      async onAuthenticate(data) {
        const url = data.request.url;
        if (!url) {
          this.logger.error('🚫 No URL provided for authentication');
          return false;
        }
        const token = url.split('token=')[1]?.split('&')[0];
        if (!token) {
          this.logger.error('🚫 No token provided in URL');
          return false;
        }
        try {
          const payload = this.jwtService.verify(token);
          data.context.userId = payload.sub;
          this.logger.log(`✅ User ${payload.sub} authenticated for document ${data.documentName}`);
          return true;
        } catch {
          this.logger.error('🚫 Invalid JWT token');
          return false;
        }
      },
      async onLoadDocument(data): Promise<Y.Doc | undefined> {
        const docId = data.documentName;
        const userId = data.context.userId;
        try {
          const doc = await this.documentsService.findById(userId, docId);
          if (doc && doc.content) {
            const json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
            const yDoc = TiptapTransformer.toYdoc(json, 'document'); // 'document' as field
            this.logger.log(`📄 Loaded document ${docId} for user ${userId}`);
            return yDoc;
          }
          this.logger.warn(`⚠️ No content found for document ${docId}`);
          return undefined;
        } catch (error) {
          this.logger.error(`🚫 Failed to load document ${docId}: ${error.message}`);
          throw error;
        }
      },
      async onStoreDocument(data) {
        const docId = data.documentName;
        const userId = data.context.userId;
        try {
          await this.documentsService.findById(userId, docId); // Access check
          const json = TiptapTransformer.fromYdoc(data.document, 'document'); // 'document' as field
          await this.documentsService.update(userId, docId, { content: json });
          this.logger.log(`💾 Document ${docId} persisted by user ${userId}`);
        } catch (error) {
          this.logger.error(`🚫 Failed to persist document ${docId}: ${error.message}`);
          throw error;
        }
      },
      onConnect: async (data) => {
        this.logger.log(
          `🔗 User ${data.context.userId} connected to document ${data.documentName}`,
        );
      },
    });

    await this.server.listen();
    // this.logger.log(`🟢 Hocuspocus server started on ws://localhost:${this.configService.get('HOCUSPOCUS_PORT', 1234)}`);
    console.log(
      `🗄️  Hocuspocus server started on ws://localhost:${this.configService.get('HOCUSPOCUS_PORT', 1234)} 🛰️`,
    );
  }

  async stop() {
    if (this.server) {
      await this.server.destroy();
      this.logger.log('🛑 Hocuspocus server stopped');
    }
  }
}
