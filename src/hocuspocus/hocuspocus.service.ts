import * as Y from 'yjs';

import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';

import { Injectable, OnModuleInit } from '@nestjs/common';
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

      onConnect: async (data) => {
        const userName = data.context.userName;
        const url =
          (data.requestHeaders['x-forwarded-url'] as string) || (data.request.url as string);
        const userIdMatch = url.match(/userId=([^&]+)/);
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';
        console.log(`👤 ${userName || userId} connected to document ${data.documentName} 📄`);
      },

      onAuthenticate: async (data) => {
        const url =
          (data.requestHeaders['x-forwarded-url'] as string) || (data.request.url as string);
        if (!url) {
          console.log('🚫 No URL provided for authentication');
          throw new Error('❌ No URL provided ❌');
          // return false;
        }
        const tokenMatch = url.match(/token=([^&]+)/);
        // const tokenMatch = token.match();
        const tokenTrue = tokenMatch ? tokenMatch[1] : null;
        if (!tokenTrue) {
          console.log('🚫 No token provided in URL');
          throw new Error('No token provided ⚠️');
          // return false;
        }
        try {
          const payload = this.jwtService.verify(tokenTrue);
          const user = await this.usersService.findById(payload.sub);
          data.context = { userId: payload.sub, userName: `${user.firstName} ${user?.lastName}` };
          console.log(
            `✅ \x1b[1m${data.context.userName}\x1b[0m 🛡️  authenticated for 📄 ${data.documentName}`,
          );
          return data.context;
          // return true;
        } catch (error) {
          console.log(`🚫 Invalid JWT token: ${error.message}`);
          throw new Error('Invalid JWT token ⚠️');
          // return false;
        }
      },

      onLoadDocument: async (data): Promise<Y.Doc> => {
        const docId = data.documentName;
        const userId = data.context.userId;

        if (!userId) {
          console.log(`🚫 No userId in context for document ${docId}`);
          throw new Error('❗User not authenticated❗');
        }

        try {
          const doc = await this.documentsService.findById(userId, docId);
          const yDoc = new Y.Doc();
          if (doc && doc.content) {
            // const json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;
            let json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;

            // ✅ CRITICAL FIX: Clean the content before transforming
            json = cleanTiptapContent(json);
            console.log('🧹 Content cleaned, transforming to Y.Doc...');

            // const yDoc = TiptapTransformer.toYdoc(json, 'document');
            TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);
            console.log(
              `🔄️ Loaded 📑 document ${docId} for 👤 \x1b[1m${data.context.userName}\x1b[0m`,
            );
          } else {
            console.log(`⚠️ No content found for document ${docId}, starting fresh`);
          }
          return yDoc;
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
