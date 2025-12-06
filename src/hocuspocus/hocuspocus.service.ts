import * as Y from 'yjs';

import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { DocumentsService } from 'src/documents/documents.service';
import { UsersService } from 'src/users/users.service';

import Image from '@tiptap/extension-image';
import Table, { TableKit, TableView } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import HardBreak from '@tiptap/extension-hard-break';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import cleanTiptapContent from 'src/common/utils/cleanTiptapContent';

@Injectable()
export class HocuspocusService implements OnModuleInit {
  private server: Server;
  private readonly logger = new Logger(HocuspocusService.name);

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private documentsService: DocumentsService,
    private usersService: UsersService,
  ) { }

  async onModuleInit() {
    await this.startServer();
  }

  private async startServer() {
    const SCHEMA_EXTENSIONS = [
      Document,
      Paragraph,
      Text,
      Heading,
      Bold,
      Italic,
      Strike,
      Link,
      Code,
      CodeBlock,
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,
      HardBreak,
      HorizontalRule,
      Image.configure({ inline: false, allowBase64: true }),
      TableKit,
    ];

    const port = Number(this.configService.get('HOCUSPOCUS_PORT')) || 1234

    this.server = new Server({
      port,
      debounce: 3000,
      maxDebounce: 10000,
      name: 'AI-Editor-Collab',

      onRequest: async (data) => {
        console.log('📨 [Request] Incoming request received');
        console.log(`📨 [Request] URL: ${data.request?.url}`);
      },

      onConnect: async (data) => {
        const userName = data.context.userName;
        const url = (data.requestHeaders['x-forwarded-url'] as string) || (data.request.url as string);
        const userIdMatch = url.match(/userId=([^&]+)/);
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';
        console.log(`👤 ${userName || userId} connected to document ${data.documentName} 📄`);
      },

      // onAuthenticate: async (data) => {
      //   console.log('🪧  [Auth] Starting authentication...');
      //   try {
      //     // console.log('🔍 [Auth] Document:', data.documentName);
      //     // console.log('🔍 [Auth] Connection:', data.connection.readyState);

      //     // 🔑 Get token from multiple sources
      //     let token = '';

      //     // 1️⃣ Check token parameter (sent via HocuspocusProvider token option)
      //     if (data.token) {
      //       token = data.token;
      //       console.log('1️⃣  [Auth] Token found in data.token');
      //     }

      //     // 2️⃣ Check request URL (fallback)
      //     if (!token) {
      //       const url = (data.requestHeaders['x-forwarded-url'] as string) || (data.request?.url as string) || '';

      //       console.log('🔍 [Auth] Request URL:', url);

      //       const tokenMatch = url.match(/[?&]token=([^&]+)/);
      //       if (tokenMatch) {
      //         token = decodeURIComponent(tokenMatch[1]);
      //         console.log('2️⃣  [Auth] Token found in URL');
      //       }
      //     }

      //     // 3️⃣ Check Authorization header
      //     if (!token) {
      //       const authHeader = data.requestHeaders['authorization'] as string;
      //       if (authHeader?.startsWith('Bearer ')) {
      //         token = authHeader.substring(7);
      //         console.log('3️⃣  [Auth] Token found in Authorization header');
      //       }
      //     }

      //     // 4. Log all headers for debugging
      //     // console.log('🔍 [Auth] All Headers:', JSON.stringify(data.requestHeaders));
      //     // console.log('🔍 [Auth] Request Parameters:', data.requestParameters);

      //     if (!token) {
      //       console.error('🚫 [Auth] No token found anywhere! ⚠️');
      //       throw new Error('No authentication token provided');
      //     }

      //     // 1️⃣ Verify JWT
      //     console.log('🔐 [Auth] Verifying JWT...');
      //     console.log('🔑 [Auth] Token (first 20 chars), verifying...', token.substring(0, 20) + '...');

      //     const payload = this.jwtService.verify(token);
      //     console.log('✅ [Auth] JWT verified, payload:', { sub: payload.sub, role: payload.role });

      //     // 2️⃣ Get user from database
      //     const user = await this.usersService.findById(payload.sub);

      //     if (!user) {
      //       console.error('❌ [Auth] User not found in database:', payload.sub);
      //       throw new Error('User not found');
      //     }

      //     // 3️⃣ Set context
      //     data.context = { userId: payload.sub, userName: `${user.firstName} ${user?.lastName}`.trim()};

      //     console.log(`✅ 👤 \x1b[1m${data.context.userName}\x1b[0m 🛡️  authenticated for 📄 ${data.documentName}`)

      //     return data.context;

      //   } catch (error) {
      //     console.error('❌ [Auth] Error:', error.message);
      //     console.error('❌ [Auth] Stack:', error.stack);
      //     throw new Error(`Authentication failed ⚠️: ${error.message}`);
      //   }
      // },

      onLoadDocument: async (data): Promise<Y.Doc> => {
        const docId = data.documentName;
        const userId = data.context.userId;

        if (!userId) {
          console.log(`🚫 No userId in context for document ${docId}`);
          throw new Error('❗User not authenticated❗');
          // return new Y.Doc(); // Return empty instead of throwing
        }

        try {
          const doc = await this.documentsService.findById(userId, docId);

          // const yDoc = new Y.Doc();
          
          if (doc && doc.content) {
            // const json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
            let json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;

            // ✅ CRITICAL FIX: Clean the content before transforming
            json = cleanTiptapContent(json);
            console.log('🧹 Content cleaned, transforming to Y.Doc...');

            const yDoc = TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);

            // TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);
            console.log(
              `🔄️ Loaded 📑 document ${docId} for 👤 \x1b[1m${data.context.userName}\x1b[0m`,
            );

            return yDoc;
          } else {
            console.log(`⚠️ No content found for document ${docId}, starting fresh`);
            return new Y.Doc();
          }
          // return yDoc;
        } catch (error) {
          console.log(`🚫 Failed to load document ${docId}: ${error.message}`);
          throw error;
        }

        // const doc = await this.documentsService.findById(userId, docId);
        // try {
        //   if (doc && doc.content) {
        //     const json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
        //     const yDoc = TiptapTransformer.toYdoc(json, 'document'); // ✅ Use this
        //     return yDoc;
        //   }
        // } catch (error) {
        //   console.error('❌ Failed to transform document:', error);
        //   return new Y.Doc();
        // }
        // return new Y.Doc();
      },

      onStoreDocument: async (data) => {
        const docId = data.documentName;
        const userId = data.context.userId;
        const userName = data.context.userName;
        if (!userId) {
          console.log(`🚫 No userId in context for document ${docId}`);
          throw new Error('❗User not authenticated❗');
        }
        try {
          await this.documentsService.findById(userId, docId);
          const json = TiptapTransformer.fromYdoc(data.document, 'document');
          await this.documentsService.update(userId, docId, { content: json });
          console.log(`💾 Document ${docId} saved by 👤 ${userName}`);
        } catch (error) {
          console.log(`🚫 Failed to persist document ${docId}: ${error.message}`);
          throw error;
        }
      },

      onDisconnect: async (data) => {
        const userName = data.context.userName;
        const url = data.requestHeaders['x-forwarded-url'] as string;
        const userIdMatch = url ? url.match(/userId=([^&]+)/) : null;
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';
        console.log(
          `🔌👤 ${userName || userId} disconnected from document ${data.documentName} 📄`,
        );
      },
    });

    await this.server.listen();
    console.log(
      `🗄️  Hocuspocus server started on ws://localhost:${port} 🛰️`,
    );
  }

  async stop() {
    if (this.server) {
      await this.server.destroy();
      console.log('🛑 Hocuspocus server stopped');
    }
  }
}
