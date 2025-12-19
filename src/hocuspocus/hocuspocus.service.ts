import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from 'src/users/users.service';
import { DocumentsService } from 'src/documents/documents.service';
import cleanTiptapContent from 'src/common/utils/cleanTiptapContent';

import HorizontalRule from '@tiptap/extension-horizontal-rule';
import OrderedList from '@tiptap/extension-ordered-list';
import BulletList from '@tiptap/extension-bullet-list';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlock from '@tiptap/extension-code-block';
import HardBreak from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import Underline from '@tiptap/extension-underline';
import ListItem from '@tiptap/extension-list-item';
import Document from '@tiptap/extension-document';
import Heading from '@tiptap/extension-heading';
import Strike from '@tiptap/extension-strike';
import Italic from '@tiptap/extension-italic';
import Image from '@tiptap/extension-image';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Link from '@tiptap/extension-link';
import Code from '@tiptap/extension-code';

import { TableKit } from '@tiptap/extension-table';

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
    console.log('⏳ Hocuspocus service initialized (waiting for HTTP server)');
    // await this.startServer();
  }

  // private async startServer() {
  async attachToHttpServer(httpServer: any) {
    const SCHEMA_EXTENSIONS = [
      Document,
      Paragraph,
      Text,
      Heading,
      Bold,
      Italic,
      Strike,
      Underline,
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

    // const port = Number(this.configService.get('HOCUSPOCUS_PORT')) || 1234

    this.server = new Server({
      // port,
      debounce: 3000,
      maxDebounce: 10000,
      name: 'AI-Editor-Collab',

      onConnect: async (data) => {
        const url = (data.requestHeaders['x-forwarded-url'] as string) || (data.request.url as string);
        const userIdMatch = url.match(/userId=([^&]+)/);
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';

        try {
          const user = await this.usersService.findById(userId);
          const userName = `${user.firstName} ${user.lastName}`.trim();

          // Store in context for later use
          data.context = { userId: user._id, userName: userName };

          console.log(`👤 ${userName} (${userId}) connected to 📄 ${data.documentName}`);

          return data.context;

        } catch (error) {
          console.warn(`⚠️ Could not load user ${userId}: ${error.message}`);
          data.context = { userId, userName: 'Anonymous' };
        }
      },

      onLoadDocument: async (data): Promise<Y.Doc> => {
        const docId = data.documentName;
        const userId = data.context?.userId || 'Unknown';
        const userName = data.context?.userName || 'Anonymous';

        console.log(`📂 Loading document "${docId}" for ${userName}`);

        try {
          const doc = await this.documentsService.findById(userId, docId);

          const yDoc = new Y.Doc();

          if (doc && doc.content) {
            let json = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content;

            // ✅ Clean the content before transforming
            json = cleanTiptapContent(json);
            console.log('🧹 Content cleaned, transforming to Y.Doc...');

            // const yDoc = TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);

            TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS,);
            console.log(
              `🔄️ Loaded 📑 \x1b[1m${doc.title}\x1b[0m for 👤 \x1b[1m${data.context.userName}\x1b[0m`,
            );

            // return yDoc;
          } else {
            console.log(`⚠️ No content found for document ${docId}, starting fresh`);
            // return new Y.Doc();
          }
          return yDoc;
        } catch (error) {
          console.log(`🚫 Failed to load document ${docId}: ${error.message}`);
          throw error;
        }
      },

      onStoreDocument: async (data) => {
        const docId = data.documentName;
        const userId = data.context.userId;
        const userName = data.context.userName;

        if (!userId) {
          console.log(`🚫 No userId in context for document ${docId}`);
          throw new Error('❗User Id not found');
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
        const userName = data.context?.userName;
        const userId = data.context?.userId || 'unknown';
        console.log(
          `🔌👤 ${userName || userId} disconnected from document ${data.documentName} 📄`,
        );
      },
    });

    // await this.server.listen();

    // console.log(
    //   `🗄️  Hocuspocus server started on ws://localhost:${port} 🛰️`,
    // );

    // ✅ Attach to existing HTTP server instead of creating new one
    // Attach Hocuspocus to an existing Nest HTTP server by forwarding
    // websocket upgrade requests to Hocuspocus' internal WebSocket server.
    // The Server.listen API expects a numeric port (it creates its own
    // HTTP server). Passing the Nest HTTP server directly as a "port"
    // caused the runtime error seen earlier. Instead, set the internal
    // httpServer reference and hook into the `upgrade` event.
    this.server.httpServer = httpServer as any;

    httpServer.on('upgrade', async (request: any, socket: any, head: any) => {
      try {
        await this.server.hocuspocus.hooks('onUpgrade', {
          request,
          socket,
          head,
          instance: this.server.hocuspocus,
        });

        this.server.webSocketServer.handleUpgrade(request, socket, head, (ws) => {
          this.server.webSocketServer.emit('connection', ws, request);
        });
      } catch (error) {
        // If a hook rejects and provides an error, destroy the socket to
        // prevent the connection from hanging.
        if (socket && typeof socket.destroy === 'function') socket.destroy();
      }
    });

    const port = this.configService.get('PORT') || 3030;
    console.log(`🗄️ Hocuspocus attached to HTTP server on port ${port} 🛰️`);
  }

  async stop() {
    if (this.server) {
      await this.server.destroy();
      console.log('🛑 Hocuspocus server stopped');
    }
  }

  getServer() {
    return this.server;
  }
}
