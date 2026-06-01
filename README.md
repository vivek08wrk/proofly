# Proofly

Proofly is a full-stack SaaS for photographers to share galleries with clients, collect selections, and export the final picks. It includes a Next.js frontend and an Express API backend with MongoDB, Redis, and Cloudflare R2 storage.

## Tech Stack

Frontend
- Next.js (App Router), React, TypeScript
- Tailwind CSS, shadcn/ui
- Redux Toolkit
- Socket.IO client

Backend
- Node.js, Express, TypeScript
- MongoDB + Mongoose
- Redis + BullMQ
- Socket.IO server
- Cloudflare R2 (S3 compatible)

## Monorepo Structure

- frontend/ - Next.js app
- backend/ - Express API server
- docs/ - Documentation (ignored in git)

## Requirements

- Node.js >= 20
- MongoDB (local or Atlas)
- Redis (local or Upstash)
- Cloudflare R2 bucket + credentials

## Environment Variables

Backend (backend/.env)

- NODE_ENV=development
- PORT=5000
- FRONTEND_URL=http://localhost:3000
- MONGODB_URI=mongodb+srv://...
- REDIS_URL=redis://...
- JWT_SECRET=your_secret
- JWT_EXPIRES_IN=7d
- R2_ACCOUNT_ID=...
- R2_ACCESS_KEY_ID=...
- R2_SECRET_ACCESS_KEY=...
- R2_PUBLIC_BUCKET_NAME=proofly-public
- R2_PRIVATE_BUCKET_NAME=proofly-private
- R2_PUBLIC_CDN_URL=https://.../cdn

Frontend (frontend/.env.local)

- NEXT_PUBLIC_API_URL=http://localhost:5000/api
- NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

## Local Development

1) Install dependencies

Backend

```bash
cd backend
npm install
```

Frontend

```bash
cd frontend
npm install
```

2) Run the dev servers

Backend

```bash
cd backend
npm run dev
```

Frontend

```bash
cd frontend
npm run dev
```

3) Open the app

- Frontend: http://localhost:3000
- Backend health: http://localhost:5000/api

## Scripts

Backend

- npm run dev - start API server with tsx watch
- npm run build - build TypeScript
- npm run start - run production build
- npm run lint - typecheck

Frontend

- npm run dev - start Next.js dev server
- npm run build - build Next.js
- npm run start - start production server
- npm run lint - lint
