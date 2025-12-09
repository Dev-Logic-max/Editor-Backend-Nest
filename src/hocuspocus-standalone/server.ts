// src/hocuspocus-standalone/server.ts
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as jwt from 'jsonwebtoken';
import { NestFactory } from '@nestjs/core';

// Import your NestJS modules
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { DocumentsService } from '../documents/documents.service';

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

// ✅ FIX: Use a DIFFERENT port than main API
// Main API uses PORT (8080), Hocuspocus uses PORT + 1000
const MAIN_PORT = parseInt(process.env.PORT || '3030');
const HOCUSPOCUS_PORT = MAIN_PORT + 1000; // e.g., 8080 + 1000 = 9080

// Create Hocuspocus server WITHOUT creating HTTP server
// Let Hocuspocus create its own server
const hocuspocus = new Server({
  port: HOCUSPOCUS_PORT,
  debounce: 3000,
  maxDebounce: 10000,
  name: 'AI-Editor-Collab',

  onRequest: async (data) => {
    console.log('📨 [Request] Incoming');
  },

  onConnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    console.log(`👤 ${userName} connected to ${data.documentName}`);
  },

  onAuthenticate: async (data) => {
    console.log('🪧 [Auth] Starting...');
    try {
      let token = '';

      if (data.token) {
        token = data.token;
      }

      if (!token) {
        const url = (data.requestHeaders['x-forwarded-url'] as string) || 
                    (data.request?.url as string) || '';
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch) {
          token = decodeURIComponent(tokenMatch[1]);
        }
      }

      if (!token) {
        throw new Error('No authentication token');
      }

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');

      const payload = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ JWT verified:', payload.sub);

      const user = await usersService.findById(payload.sub);

      if (!user) {
        throw new Error('User not found');
      }

      data.context = { 
        token: token,
        userId: payload.sub, 
        userName: `${user.firstName} ${user.lastName || ''}`.trim()
      };

      console.log(`✅ ${data.context.userName} authenticated`);
      return data.context;

    } catch (error: any) {
      console.error('❌ Auth error:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  },

  onLoadDocument: async (data): Promise<Y.Doc> => {
    const docId = data.documentName;
    const userId = data.context?.userId;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      const doc = await documentsService.findById(userId, docId);
      const yDoc = new Y.Doc();
      
      if (doc && doc.content) {
        let json = typeof doc.content === 'string' 
          ? JSON.parse(doc.content) 
          : doc.content;

        json = cleanTiptapContent(json);
        TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);
        console.log(`🔄 Loaded "${doc.title}"`);
      } else {
        console.log(`⚠️ No content for ${docId}`);
      }
      
      return yDoc;
    } catch (error: any) {
      console.log(`🚫 Load failed: ${error.message}`);
      return new Y.Doc();
    }
  },

  onStoreDocument: async (data) => {
    const docId = data.documentName;
    const userId = data.context?.userId;
    
    if (!userId) return;
    
    try {
      const json = TiptapTransformer.fromYdoc(data.document, 'document');
      await documentsService.update(userId, docId, { content: json });
      console.log(`💾 Saved ${docId}`);
    } catch (error: any) {
      console.log(`🚫 Save failed: ${error.message}`);
    }
  },

  onDisconnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    console.log(`🔌 ${userName} disconnected`);
  },
});

// Start function
async function bootstrap() {
  await initializeServices();

  console.log(`
  ✨  ================================  ✨
  🛰️  Hocuspocus Starting...
  🛰️  Port: ${HOCUSPOCUS_PORT}
  ✨  ================================  ✨
  `);

  await hocuspocus.listen();
  
  console.log(`✅ Hocuspocus running on port ${HOCUSPOCUS_PORT}`);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await hocuspocus.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await hocuspocus.destroy();
  process.exit(0);
});

bootstrap();