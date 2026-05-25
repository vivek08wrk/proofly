# **Complete Deployment Guide: Proofly to Vercel + Render**

This guide walks you through deploying your **Proofly** application with the frontend on **Vercel** and backend on **Render**.

---

## **Table of Contents**

1. [Pre-Deployment Setup](#part-1-pre-deployment-setup)
2. [Frontend Deployment (Vercel)](#part-2-frontend-deployment-nextjs--vercel)
3. [Backend Deployment (Render)](#part-3-backend-deployment-nodeexpress--render)
4. [Environment Variables Reference](#part-5-environment-variables-reference)
5. [Post-Deployment Verification](#part-6-post-deployment-verification)
6. [Important Notes](#part-7-important-notes)
7. [Troubleshooting](#troubleshooting-checklist)
8. [Quick Commands](#quick-command-reference)

---

## **PART 1: PRE-DEPLOYMENT SETUP**

### **Step 1.1: Prepare Your Git Repository**

Ensure your project is pushed to GitHub (both Vercel and Render pull directly from Git):

```bash
# From project root, initialize git if not already done
git init
git add .
git commit -m "Initial commit before deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/proofly.git
git push -u origin main
```

> **Note**: Your repo can be public or private—both work with Vercel and Render.

---

### **Step 1.2: Build & Test Locally**

Verify both apps build without errors:

```bash
# Frontend build test
cd frontend
npm run build

# Backend build test
cd ../backend
npm run build
```

If both succeed, proceed. If not, fix errors locally first.

---

## **PART 2: FRONTEND DEPLOYMENT (Next.js → Vercel)**

### **Step 2.1: Create Vercel Account**

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (recommended for seamless CI/CD)
3. Authorize Vercel to access your GitHub account

### **Step 2.2: Import Project on Vercel**

1. Click **"Add New..."** → **"Project"**
2. Select your **proofly** repository
3. Vercel auto-detects it's a Next.js project
4. Accept defaults (Root Directory: `./`, Framework: Next.js)

### **Step 2.3: Configure Environment Variables**

Before deploying, add your frontend environment variables to Vercel:

1. In the Vercel dashboard, go to your project → **Settings** → **Environment Variables**
2. Add the following variables:

```
NEXT_PUBLIC_API_URL=https://proofly-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://proofly-backend.onrender.com
```

> **Note**: Replace `proofly-backend` with your actual Render app name (you'll set this in Part 3).

**Frontend `.env.local` reference (for local testing):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### **Step 2.4: Deploy**

1. Click **"Deploy"**
2. Wait for build to complete (usually 2-5 min)
3. Get your frontend URL: `https://your-frontend-app.vercel.app`

### **Step 2.5: Configure CORS on Backend (Important!)**

Once you have your Vercel URL, you'll need to update your backend to allow requests from that domain. (You'll do this in Part 3.)

---

## **PART 3: BACKEND DEPLOYMENT (Node.js/Express → Render)**

### **Step 3.1: Create Render Account**

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Authorize Render to access your GitHub

### **Step 3.2: Create New Web Service on Render**

1. Click **"New+"** → **"Web Service"**
2. Select your **proofly** repository
3. **Configure the service:**
   - **Name**: `proofly-backend`
   - **Runtime**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm run build`
   - **Start Command**: `node dist/server.js`

4. Click **"Create Web Service"**

### **Step 3.3: Add Environment Variables to Render**

In Render dashboard, go to your service → **Environment** → add these variables:

```
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=your_mongodb_uri_here
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Redis
REDIS_URL=your_redis_url_here

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id_here
R2_ACCESS_KEY_ID=your_r2_access_key_here
R2_SECRET_ACCESS_KEY=your_r2_secret_key_here
R2_PUBLIC_BUCKET_NAME=proofly-public
R2_PRIVATE_BUCKET_NAME=proofly-private
R2_PUBLIC_CDN_URL=your_r2_cdn_url_here

# Frontend URL (CORS)
FRONTEND_URL=https://your-frontend-app.vercel.app
```

### **Step 3.4: Enable CORS in Backend**

Update your backend server to allow your Vercel frontend domain. Check your `src/server.ts`:

```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
```

Ensure this line is present (it likely already is).

### **Step 3.5: Wait for Render Deployment**

1. Render will auto-deploy when you add env vars
2. Watch the **Logs** tab for build completion
3. Once deployed, you'll see a green checkmark
4. Your backend URL: `https://proofly-backend.onrender.com`

---

## **PART 4: UPDATE FRONTEND ENV VARS (Connect Both)**

Now that you have both URLs, update Vercel environment variables:

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Update:
   ```
   NEXT_PUBLIC_API_URL=https://proofly-backend.onrender.com
   NEXT_PUBLIC_SOCKET_URL=https://proofly-backend.onrender.com
   ```
3. **Redeploy**: Click **Deployments** → **Redeploy** on latest deployment

---

## **PART 5: ENVIRONMENT VARIABLES REFERENCE**

### **Frontend (Vercel) - `NEXT_PUBLIC_*` only**

These variables are exposed to the browser and must be prefixed with `NEXT_PUBLIC_`:

```env
NEXT_PUBLIC_API_URL=https://proofly-backend.onrender.com
NEXT_PUBLIC_SOCKET_URL=https://proofly-backend.onrender.com
```

**Where to find:**
- Vercel Dashboard → Project → Settings → Environment Variables

---

### **Backend (Render) - All Variables**

These are server-only variables:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-app.vercel.app

# Database (get from MongoDB Atlas)
MONGODB_URI=mongodb+srv://user:pass@cluster0.mongodb.net/database?appName=Cluster0

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-random-string-here-min-32-chars
JWT_EXPIRES_IN=7d

# Redis (get from Upstash or similar)
REDIS_URL=redis://default:password@host:6379

# Cloudflare R2 (from your R2 dashboard)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_PUBLIC_BUCKET_NAME=proofly-public
R2_PRIVATE_BUCKET_NAME=proofly-private
R2_PUBLIC_CDN_URL=https://pub-xxxxx.r2.dev
```

**Where to find each variable:**

| Variable | Source |
|----------|--------|
| `MONGODB_URI` | MongoDB Atlas → Connect → Connection String |
| `REDIS_URL` | Upstash Console → Database → Redis URL |
| `R2_ACCOUNT_ID` | Cloudflare Dashboard → Account ID |
| `R2_ACCESS_KEY_ID` | R2 → API Tokens → Create API Token |
| `R2_SECRET_ACCESS_KEY` | R2 → API Tokens → Create API Token |
| `R2_PUBLIC_CDN_URL` | R2 → Buckets → Select bucket → Details tab |

---

## **PART 6: POST-DEPLOYMENT VERIFICATION**

### **Test API Health**

```bash
# From your terminal or browser
curl https://proofly-backend.onrender.com/api/health
```

Expected response:
```json
{
  "success": true,
  "message": "Proofly API is running",
  "timestamp": "2026-05-25T10:30:00.000Z",
  "environment": "production"
}
```

### **Test Frontend**

1. Open `https://your-frontend-app.vercel.app`
2. Try logging in or creating a project
3. Check browser console for errors (DevTools → Console)
4. Verify API calls succeed (DevTools → Network tab → see 200 responses)

### **Check Logs**

**Vercel Logs**:
- Dashboard → Deployments → Click on latest deployment → Function Logs tab

**Render Logs**:
- Dashboard → Select service → Logs tab (in real-time)

---

## **PART 7: IMPORTANT NOTES**

### **Cold Starts & Performance**

- **Render Free Tier**: Services go to sleep after 15 minutes of inactivity. Your first request after sleep will take 30-60 seconds. **Recommended**: Upgrade to paid tier for production.
- **Vercel**: Serverless functions have slight cold starts (~100ms) but are free within generous limits.

### **Database & External Services Whitelisting**

#### **MongoDB Atlas**
Must allow Render's IP address:
1. Go to MongoDB Atlas → **Network Access**
2. Click **"Add IP Address"**
3. Option A: Add Render's IP (check Render logs for exact IP)
4. Option B (less secure): Allow `0.0.0.0/0` (all IPs)

#### **Redis (Upstash)**
Similar whitelisting may be required:
1. Go to Upstash Console → Database → **Settings**
2. Look for "Allowed Origins" or similar
3. Add Render's IP or allow all

#### **Cloudflare R2**
- No IP restrictions needed (uses API key authentication)
- Verify API credentials are correct

### **Custom Domain** (Optional)

#### **Vercel**
1. Go to project → **Settings** → **Domains**
2. Add your custom domain (e.g., `proofly.com`)
3. Follow DNS configuration steps

#### **Render**
1. Go to service → **Settings** → **Custom Domain**
2. Add your custom domain
3. Follow DNS configuration steps

### **SSL/HTTPS**

Both Vercel and Render provide **free SSL certificates automatically**. Your apps are HTTPS-enabled by default.

---

## **Troubleshooting Checklist**

| Issue | Cause | Solution |
|-------|-------|----------|
| **"Failed to connect to API"** | Frontend can't reach backend | 1. Check `NEXT_PUBLIC_API_URL` is correct<br>2. Ensure backend is running (check Render logs)<br>3. Verify CORS is enabled on backend |
| **CORS error in browser** | Backend rejecting frontend domain | 1. Verify `FRONTEND_URL` env var matches Vercel URL exactly<br>2. Restart Render service after env var change<br>3. Check CORS middleware in `src/server.ts` |
| **Backend won't start / 503 error** | Build or startup issue | 1. Check Render logs for specific error<br>2. Ensure `npm run build` works locally<br>3. Verify all required env vars are set (none are empty)<br>4. Test database/Redis connectivity |
| **MongoDB connection timeout** | Database unreachable | 1. Whitelist Render IP in MongoDB Atlas Network Access<br>2. Verify `MONGODB_URI` is correct (test locally)<br>3. Check MongoDB Atlas cluster is running |
| **Redis connection refused** | Redis unreachable | 1. Whitelist Render IP in Redis settings<br>2. Verify `REDIS_URL` is correct<br>3. Test connection locally with `redis-cli` |
| **Socket.IO not connecting** | Socket endpoint unreachable | 1. Verify `NEXT_PUBLIC_SOCKET_URL` points to Render backend<br>2. Ensure Socket.IO is enabled on backend (check `src/server.ts`)<br>3. Check CORS settings allow Socket.IO |
| **Vercel build fails** | Next.js build error | 1. Check Vercel build logs<br>2. Run `npm run build` locally and fix errors<br>3. Ensure all imports are correct<br>4. Check TypeScript errors with `npm run type-check` |
| **Images not loading** | R2 CDN issue | 1. Verify `R2_PUBLIC_CDN_URL` is correct<br>2. Test URL directly in browser<br>3. Check R2 bucket permissions |

---

## **Quick Command Reference**

### **Local Development & Testing**

```bash
# Install dependencies
npm install

# Frontend: Build and test locally
cd frontend
npm run build
npm start

# Backend: Build and test locally
cd backend
npm run build
npm start

# Run in development mode
npm run dev
```

### **Monitor Deployed Apps**

```bash
# Backend health check
curl https://proofly-backend.onrender.com/api/health

# Check deployment status
# Vercel: Dashboard → Deployments tab
# Render: Dashboard → Logs tab

# View real-time Render logs (requires Render CLI)
render logs --service proofly-backend --tail
```

### **Redeploy**

```bash
# Vercel: Via Dashboard → Deployments → Redeploy button
# Or push new commit to main branch (auto-redeploys)

# Render: Via Dashboard → Manual Deploy button
# Or push new commit to main branch (auto-redeploys)
```

---

## **Deployment Checklist**

Before going live, verify:

- [ ] Git repository is public and pushed to GitHub
- [ ] Both `npm run build` commands succeed locally
- [ ] All environment variables are documented and available
- [ ] MongoDB Atlas whitelist includes Render IP (or allows all)
- [ ] Redis connection verified
- [ ] R2 API credentials are valid and buckets exist
- [ ] Frontend `.env.local` has correct backend URL for local testing
- [ ] Backend CORS is set to frontend URL (not `*`)
- [ ] `JWT_SECRET` is a strong random string (min 32 chars)
- [ ] `FRONTEND_URL` env var on Render matches exact Vercel URL
- [ ] All deployed apps respond to health/status checks
- [ ] Socket.IO connects successfully between frontend and backend
- [ ] File uploads work end-to-end
- [ ] Gallery displays images correctly

---

## **Production Recommendations**

### **Monitoring**
- Set up error tracking (e.g., Sentry) on both frontend and backend
- Monitor API response times and error rates
- Set up uptime monitoring (e.g., Uptime Robot)

### **Performance**
- Enable caching headers on Vercel for static assets
- Use CDN for R2 (Cloudflare already does this)
- Consider upgrading Render to paid tier to avoid cold starts

### **Security**
- Use strong, unique `JWT_SECRET`
- Rotate API keys regularly
- Enable GitHub branch protection on `main`
- Review Cloudflare R2 bucket permissions (least privilege)

### **Scaling**
- Monitor database query performance
- Consider database indexing if slow queries appear
- Use Redis effectively for caching
- Enable auto-scaling if traffic grows

---

## **Next Steps**

1. ✅ Create accounts on Vercel and Render
2. ✅ Push your repository to GitHub
3. ✅ Deploy backend to Render (Part 3)
4. ✅ Capture deployed backend URL
5. ✅ Deploy frontend to Vercel (Part 2)
6. ✅ Update environment variables to connect both
7. ✅ Run post-deployment verification (Part 6)
8. ✅ Monitor logs for errors

---

## **Support & Resources**

- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Express.js Deployment**: https://expressjs.com/en/advanced/best-practice-performance.html
- **MongoDB Atlas**: https://www.mongodb.com/docs/atlas/
- **Cloudflare R2**: https://developers.cloudflare.com/r2/

---

**Last Updated**: May 25, 2026  
**Version**: 1.0

For questions or issues, refer to the troubleshooting section or check platform-specific logs.
