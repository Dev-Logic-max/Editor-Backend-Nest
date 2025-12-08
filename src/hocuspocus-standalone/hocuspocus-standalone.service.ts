// src/hocuspocus-standalone/server.ts
import * as Y from 'yjs';
import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { createServer } from 'http';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';

// TipTap extensions for schema
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

// Load environment variables
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

// Helper function to clean Tiptap content
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

// API client to communicate with your main backend
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3030';
const INTERNAL_API_KEY = process.env.JWT_SECRET || 'your-secret-key';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${INTERNAL_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// API functions
async function fetchDocument(userId: string, docId: string, userToken: string) {
  try {
    const response = await apiClient.get(`/documents/${docId}`, {
      headers: { 
        'Authorization': `Bearer ${userToken}`  // Add this
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch document:', error);
    throw error;
  }
}

async function updateDocument(userId: string, docId: string, content: any, userToken: string) {
  try {
    const response = await apiClient.put(`/documents/${docId}`, 
      { content },
      { 
        headers: { 
          'Authorization': `Bearer ${userToken}`  // Add this
        } 
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to update document:', error);
    throw error;
  }
}

async function fetchUser(userId: string, userToken: string) {  
  try {
    const response = await apiClient.get(`/users/${userId}`, {
      headers: { 
        'Authorization': `Bearer ${userToken}`  // Use actual user token
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error(`⚠️ hello Authentication failed: ${error.message}`);
  }
}

// HTTP server will be created by Hocuspocus
const httpServer = createServer();

// Create Hocuspocus server with port
const hocuspocus = new Server({
  port: parseInt(process.env.HOCUSPOCUS_PORT || '1234'),
  debounce: 3000,
  maxDebounce: 10000,
  name: 'AI-Editor-Collab',

  onRequest: async (data) => {
    console.log('📨 [Request] Incoming request received');
    console.log(`📨 [Request] URL: ${data.request?.url}`);
  },

  onConnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    const userId = data.context?.userId || 'unknown';
    console.log(`👤 ${userName} (${userId}) connected to document ${data.documentName} 📄`);
  },

  onAuthenticate: async (data) => {
    console.log('🪧 [Auth] Starting authentication...');
    try {
      // Get token from multiple sources
      let token = '';

      // 1. Check token parameter (sent via HocuspocusProvider token option)
      if (data.token) {
        token = data.token;
        console.log('1️⃣ [Auth] Token found in data.token');
      }

      // 2. Check request URL (fallback)
      if (!token) {
        const url = (data.requestHeaders['x-forwarded-url'] as string) ||  (data.request?.url as string) || '';
        
        console.log('🔍 [Auth] Request URL:', url);
        
        const tokenMatch = url.match(/[?&]token=([^&]+)/);
        if (tokenMatch) {
          token = decodeURIComponent(tokenMatch[1]);
          console.log('2️⃣ [Auth] Token found in URL');
        }
      }

      if (!token) {
        console.error('🚫 [Auth] No token found anywhere! ⚠️');
        throw new Error('No authentication token provided');
      }

      // Verify JWT
      console.log('🔐 [Auth] Verifying JWT...');
      console.log('🔑 [Auth] Token (first 20 chars):', token.substring(0, 20) + '...');

      const JWT_SECRET = process.env.JWT_SECRET;
      if (!JWT_SECRET) {
        throw new Error('JWT_SECRET not configured');
      }

      const payload = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ [Auth] JWT verified, payload:', { 
        sub: payload.sub, 
        role: payload.role 
      });

      // Get user from database
      const user = await fetchUser(payload.sub, token);

      if (!user) {
        console.error('❌ [Auth] User not found in database:', payload.sub);
        throw new Error('User not found');
      }

      // Set context
      data.context = { 
        token: token,
        userId: payload.sub, 
        userName: `${user.data.firstName} ${user?.data.lastName || ''}`.trim()
      };

      console.log(`✅ 👤 \x1b[1m${data.context.userName}\x1b[0m 🛡️ authenticated for 📄 ${data.documentName}`);

      return data.context;

    } catch (error: any) {
      console.error('❌ [Auth] Error:', error.message);
      console.error('❌ [Auth] Stack:', error.stack);
      throw new Error(`Authentication failed ⚠️: ${error.message}`);
    }
  },

  onLoadDocument: async (data): Promise<Y.Doc> => {
    const docId = data.documentName;
    const token = data.context?.token;
    const userId = data.context?.userId;
    const userName = data.context?.userName;

    if (!userId) {
      console.log(`🚫 No userId in context for document ${docId}`);
      throw new Error('❗User not authenticated❗');
    }

    try {
      const doc = await fetchDocument(userId, docId, token);
      const yDoc = new Y.Doc();
      
      if (doc && doc.content) {
        let json = typeof doc.content === 'string'  ? JSON.parse(doc.content) : doc.content;

        // Clean the content before transforming
        json = cleanTiptapContent(json);
        console.log('🧹 Content cleaned, transforming to Y.Doc...');

        TiptapTransformer.toYdoc(json, 'document', SCHEMA_EXTENSIONS);
        console.log(
          `🔄️ Loaded 📑 "${doc.data?.title || 'Untitled'}" (${docId}) for 👤 \x1b[1m${userName}\x1b[0m`,
        );
      } else {
        console.log(`⚠️ No content found for document ${docId}, starting fresh`);
      }
      
      return yDoc;
    } catch (error: any) {
      console.log(`🚫 Failed to load document ${docId}: ${error.message}`);
      // Return empty doc instead of throwing
      return new Y.Doc();
    }
  },

  onStoreDocument: async (data) => {
    const docId = data.documentName;
    const token = data.context?.token;
    const userId = data.context?.userId;
    const userName = data.context?.userName || 'Unknown';
    
    if (!userId) {
      console.log(`🚫 No userId in context for document ${docId}`);
      return; // Don't throw, just skip saving
    }
    
    try {
      const json = TiptapTransformer.fromYdoc(data.document, 'document');
      const result = await updateDocument(userId, docId, json, token);
      console.log(`💾 Document "${result.data?.title || docId}" (${docId}) saved by 👤 ${userName}`);
    } catch (error: any) {
      console.log(`🚫 Failed to persist document ${docId}: ${error.message}`);
      // Don't throw - just log the error
    }
  },

  onDisconnect: async (data) => {
    const userName = data.context?.userName || 'Unknown';
    const userId = data.context?.userId || 'unknown';
    console.log(
      `🔌👤 ${userName} (${userId}) disconnected from document ${data.documentName} 📄`,
    );
  },
});

// Start server
const PORT = parseInt(process.env.HOCUSPOCUS_PORT || '1234');
const HOST = '0.0.0.0';

// Attach HTTP health check routes to Hocuspocus
httpServer.on('request', (req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      service: 'hocuspocus-collaboration',
      timestamp: new Date().toISOString()
    }));
  }
});

// Start Hocuspocus (it will use the port from config)
hocuspocus.listen().then(() => {
  console.log(`
  ✨  ================================  ✨
  🛰️    Port: ${PORT}  Host: ${HOST}    🛰️  
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await hocuspocus.destroy();
  httpServer.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await hocuspocus.destroy();
  httpServer.close();
  process.exit(0);
});