# 📝 Collaborative Editor Backend (NestJS)

A scalable and real-time backend built using **NestJS**, **MongoDB**, **WebSockets**, and **Hocuspocus** to power a collaborative TipTap editor with user authentication, document syncing, metadata tracking, and file uploads.

---

## 🚀 Features

### 🔐 Authentication & Authorization
- JWT-based authentication  
- Role-based access control  
- Guards & strategies included (JWT, Local)  

### 📝 Collaborative Editing
- Integrated with **Hocuspocus Server**
- Real-time document syncing (Yjs awareness)
- Metadata tracking (createdBy, updatedBy, timestamps, etc.)

### 🗂 Document Management
- Create, update, delete documents
- MongoDB persistence using Mongoose
- Document schemas built for multi-user editing

### 🔄 WebSocket Layer
- Real-time requests and events
- Gateway for client collaboration events

### 📁 File Uploads
- Upload service included
- Extendable for S3, Cloudinary, or local storage

### 👨‍💻 Tech Stack
- **NestJS**
- **TypeScript**
- **MongoDB + Mongoose**
- **WebSockets (Gateway)**
- **Hocuspocus Server**
- **Yjs**
- **JWT Auth**

---

## 📦 Installation

Clone the project:

```bash
git clone https://github.com/<username>/Editor-Backend-Nest.git
cd Editor-Backend-Nest
