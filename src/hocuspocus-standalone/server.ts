// src/hocuspocus-standalone/server.ts
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { createServer } from 'http';
import * as jwt from 'jsonwebtoken';
import { NestFactory } from '@nestjs/core';

// Import your NestJS modules
import { AppModule } from 'src/app.module';
import { UsersService } from 'src/users/users.service';
import { DocumentsService } from 'src/documents/documents.service';

// TipTap extensions
import Image from '@tiptap/extension-image';
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
import { TableKit } from '@tiptap/extension-table';

import * as dotenv from 'dotenv';
dotenv.config();

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

function cleanTiptapContent(content: any): any {
  if (!content || typeof content !== 'object') return content;

  if (content.type === 'table') {
    if (content.content) {
      content.content = content.content.map((row: any) => {
        if (row.type === 'tableRow' && row.content) {
          row.content = row.content.filter((cell: any) => 
            cell.type === 'tableCell' || cell.type === 'tableHeader'
          );
        }
        return row;
      });
    }
  }

  if (content.content && Array.isArray(content.content)) {
    content.content = content.content.map((child: any) => cleanTiptapContent(child));
  }

  return content;
}

// Initialize NestJS services
let usersService: UsersService;
let documentsService: DocumentsService;

async function initializeServices() {
  const app = await NestFactory.createApplicationContext(AppModule);
  usersService = app.get(UsersService);
  documentsService = app.get(DocumentsService);
  console.log('✅ NestJS services initialized');
}

// Create HTTP server
const httpServer = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'hocuspocus-collaboration',
      timestamp: new Date().toISOString()
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

// Create Hocuspocus server
const hocuspocus = new Server({
  port: parseInt(process.env.HOCUSPOCUS_PORT || '1234'),
  debounce: 3000,
  maxDebounce: 10000,
  name: 'AI-Editor-Collab',

  onRequest: async (data) => {
    console.log('📨 [Request] Incoming request');
  },

  onConnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    const userId = data.context?.userId || 'unknown';
    console.log(`👤 ${userName} (${userId}) connected to ${data.documentName} 📄`);
  },

  onAuthenticate: async (data) => {
    console.log('🪧 [Auth] Starting authentication...');
    try {
      let token = '';

      if (data.token) {
        token = data.token;
        console.log('1️⃣ [Auth] Token found in data.token');
      }

      if (!token) {
        const url = (data.requestHeaders['x-forwarded-url'] as string) || 
                    (data.request?.url as string) || '';
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch) {
          token = decodeURIComponent(tokenMatch[1]);
          console.log('2️⃣ [Auth] Token found in URL');
        }
      }

      if (!token) {
        console.error('🚫 [Auth] No token found!');
        throw new Error('No authentication token provided');
      }

      console.log('🔐 [Auth] Verifying JWT...');

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');

      const payload = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ [Auth] JWT verified:', { sub: payload.sub, role: payload.role });

      // ✅ Use NestJS service directly
      const user = await usersService.findById(payload.sub);

      if (!user) {
        console.error('❌ [Auth] User not found:', payload.sub);
        throw new Error('User not found');
      }

      data.context = { 
        token: token,
        userId: payload.sub, 
        userName: `${user.firstName} ${user.lastName || ''}`.trim()
      };

      console.log(`✅ 👤 ${data.context.userName} 🛡️ authenticated for 📄 ${data.documentName}`);

      return data.context;

    } catch (error: any) {
      console.error('❌ [Auth] Error:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  },

  onLoadDocument: async (data): Promise<Y.Doc> => {
    const docId = data.documentName;
    const userId = data.context?.userId;
    const userName = data.context?.userName;

    if (!userId) {
      console.log(`🚫 No userId for document ${docId}`);
      throw new Error('User not authenticated');
    }

    try {
      // ✅ Use NestJS service directly
      const doc = await documentsService.findById(userId, docId);
      const yDoc = new Y.Doc();
      
      if (doc && doc.content) {
        let json = typeof doc.content === 'string' 
          ? JSON.parse(doc.content) 
          : doc.content;

        json = cleanTiptapContent(json);
        console.log('🧹 Content cleaned');

        TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);
        console.log(`🔄️ Loaded "${doc.title}" for 👤 ${userName}`);
      } else {
        console.log(`⚠️ No content for document ${docId}`);
      }
      
      return yDoc;
    } catch (error: any) {
      console.log(`🚫 Failed to load document ${docId}: ${error.message}`);
      return new Y.Doc();
    }
  },

  onStoreDocument: async (data) => {
    const docId = data.documentName;
    const userId = data.context?.userId;
    const userName = data.context?.userName || 'Unknown';
    
    if (!userId) {
      console.log(`🚫 No userId for document ${docId}`);
      return;
    }
    
    try {
      const json = TiptapTransformer.fromYdoc(data.document, 'document');
      
      // ✅ Use NestJS service directly
      await documentsService.update(userId, docId, { content: json });
      
      console.log(`💾 Document ${docId} saved by 👤 ${userName}`);
    } catch (error: any) {
      console.log(`🚫 Failed to save document ${docId}: ${error.message}`);
    }
  },

  onDisconnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    console.log(`🔌 ${userName} disconnected from ${data.documentName}`);
  },
});

// Start everything
async function bootstrap() {
  // Initialize NestJS services first
  await initializeServices();

  const PORT = parseInt(process.env.HOCUSPOCUS_PORT || '1234');
  const HOST = '0.0.0.0';

  // Start HTTP server
  httpServer.listen(PORT, HOST, () => {
    console.log(`
  ✨  ================================  ✨
  🛰️  Hocuspocus Server Started
  🛰️  Port: ${PORT}  Host: ${HOST}
  🛰️  Health: http://${HOST}:${PORT}/health
  ✨  ================================  ✨
    `);
  });

  // Attach Hocuspocus
  await hocuspocus.listen();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await hocuspocus.destroy();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await hocuspocus.destroy();
  httpServer.close();
  process.exit(0);
});

bootstrap();