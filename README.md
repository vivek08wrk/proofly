# Proofly

Proofly is a full-stack photo proofing platform for photographers. Photographers can create client projects, upload galleries, share public selection links, track client picks in real time, and export the final selected images.

The repository is split into a Next.js frontend and an Express API backend. The backend stores project metadata in MongoDB, keeps original and optimized image assets in Cloudflare R2, and uses Socket.IO for upload and selection updates.

## Features

- Photographer registration, login, logout, and protected dashboard routes.
- Project creation with public gallery slugs.
- ZIP and folder-style photo upload workflows.
- Direct browser-to-R2 upload support through presigned URLs.
- Image preview generation and original-file storage.
- Public client gallery with masonry layout, lightbox viewing, and saved selections.
- Real-time upload progress and selection updates with Socket.IO.
- Photographer dashboard for project status, gallery sharing, selection review, and downloads.
- CSV and ZIP export routes for selected photos.

## Tech Stack

### Frontend

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui-style components
- Redux Toolkit for client state
- Socket.IO client for live updates
- browser-image-compression and JSZip for client-side upload preparation

### Backend

- Node.js, Express, and TypeScript
- MongoDB with Mongoose
- Redis client setup with ioredis
- Socket.IO server
- Cloudflare R2 through the AWS S3-compatible SDK
- Sharp, Busboy, Archiver, and Unzipper for image and archive workflows

> Note: BullMQ is not currently installed or used. The project has Redis/ioredis preparation, but background queue workers are still a future enhancement.

## Repository Structure

```text
proofly/
  backend/   Express API server
  frontend/  Next.js web app
  docs/      Project documentation
```

## Requirements

- Node.js 20 or newer
- npm
- MongoDB connection string, either local or Atlas
- Redis connection string, either local or hosted
- Cloudflare R2 account, buckets, and access credentials

## Environment Variables

Create `backend/.env`:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...

JWT_SECRET=your_secret
JWT_EXPIRES_IN=7d

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BUCKET_NAME=proofly-public
R2_PRIVATE_BUCKET_NAME=proofly-private
R2_PUBLIC_CDN_URL=https://.../cdn
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## Local Development

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Start the backend API:

```bash
cd backend
npm run dev
```

Start the frontend app in a second terminal:

```bash
cd frontend
npm run dev
```

Then open:

- Frontend: `http://localhost:3000`
- Backend health check: `http://localhost:5000/api/health`
- Backend root: `http://localhost:5000`

## Available Scripts

Backend scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with `tsx watch`. |
| `npm run build` | Compile TypeScript and rewrite path aliases. |
| `npm run start` | Run the compiled production server. |
| `npm run lint` | Run TypeScript type checks with `tsc --noEmit`. |

Frontend scripts:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the Next.js app for production. |
| `npm run start` | Run the production Next.js server. |
| `npm run lint` | Run the frontend linter. |

## Main API Areas

- `POST /api/auth/register` and `POST /api/auth/login` for photographer auth.
- `GET /api/auth/me` for authenticated session lookup.
- `/api/projects` for project creation, listing, detail, and deletion.
- `/api/upload` for presigned uploads, processing, multipart upload sessions, cancellation, and photo finalization.
- `/api/gallery/:slug` for public gallery loading and client selections.
- `/api/download/:projectId/csv` and `/api/download/:projectId/zip` for selected-photo exports.

## Development Notes

- Keep `NEXT_PUBLIC_API_URL` and `FRONTEND_URL` aligned so browser requests and cookies work correctly.
- Large upload flows depend on R2 credentials and bucket configuration being valid.
- Redis is configured as optional infrastructure for future cache or queue features; the current app should not be documented as using BullMQ until the dependency and workers are added.
- Run backend and frontend checks before pushing changes that touch application code.
