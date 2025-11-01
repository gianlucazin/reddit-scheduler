# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **serverless full-stack Reddit post scheduler** that runs entirely on free tiers (Vercel + GitHub Actions). It uses OAuth for Reddit authentication, encrypts refresh tokens with AES-256-CBC, and leverages GitHub Actions as an external cron service to trigger scheduled posts every 10 minutes.

## Architecture

### High-Level Pattern

```
Frontend (React/Vite) ←→ API Routes (Vercel Functions) ←→ Database (Postgres)
                                    ↑
                         GitHub Actions (Cron Worker)
```

**Key architectural decisions:**
- **Serverless-first**: All backend logic runs as stateless Vercel functions
- **Zero-cost focus**: Designed to run on free tiers (no paid services required)
- **Security-first**: Encrypted token storage, no client-side token exposure
- **External scheduler**: GitHub Actions calls `/api/run-scheduler` every 10 minutes

### Authentication & Security Flow

1. User clicks login → Reddit OAuth → `/api/auth` callback
2. Backend encrypts refresh token (AES-256-CBC) → stores in Postgres
3. Frontend receives user data → stores in localStorage (no tokens)
4. Cron worker decrypts tokens → refreshes access tokens → posts to Reddit

**Important**: Refresh tokens are NEVER exposed to the frontend. All sensitive operations happen server-side.

### Database Schema

- `users` table: Reddit usernames + encrypted refresh tokens
- `scheduled_posts` table: Post content, schedule time, status (pending/sent/failed)
- Foreign key constraint with CASCADE delete
- Indexed on `schedule_time` and `status` for efficient cron queries

## Development Commands

### Local Development (Dual-Server Setup)

**IMPORTANT**: You MUST run BOTH servers concurrently for local development to work:

```bash
# Terminal 1: Backend (Vercel serverless functions)
vercel dev
# Runs on http://localhost:3000
# Serves ONLY API routes (/api/*)

# Terminal 2: Frontend (Vite dev server)
npm run dev
# Runs on http://localhost:5173
# Serves the React app with HMR
# Proxies /api/* requests to port 3000
```

**Access the app at `http://localhost:5173`** ← Use this URL!

**Do NOT use port 3000** for browsing. While it may appear to serve the app, it won't work correctly because Vite isn't processing the JSX/modules. Port 3000 is ONLY for API functions - the Vite dev server at 5173 automatically proxies API calls to it.

### Build & Preview

```bash
npm run build    # Builds frontend to /dist
npm run preview  # Preview production build locally
```

### Database Migrations

**No migration tool configured** - run SQL manually:

```bash
# In Vercel Postgres console or local psql
psql $POSTGRES_URL < migrations/001_initial_schema.sql
```

## Environment Variables

### Required Variables

**Reddit OAuth:**
- `REDDIT_CLIENT_ID` - From Reddit app settings
- `REDDIT_CLIENT_SECRET` - From Reddit app settings
- `REDDIT_REDIRECT_URI` - OAuth callback (e.g., `https://your-app.vercel.app/api/auth`)
- `VITE_REDDIT_CLIENT_ID` - Frontend-accessible client ID (VITE_ prefix required!)
- `VITE_REDDIT_REDIRECT_URI` - Frontend-accessible redirect URI

**Security:**
- `ENCRYPTION_KEY` - 64-char hex string (generate with `openssl rand -hex 32`)
- `SCHEDULER_AUTH_TOKEN` - Bearer token for protecting `/api/run-scheduler`

**Database:**
- `POSTGRES_URL` - Postgres connection string (auto-provided by Vercel, required by @vercel/postgres)

**Important Notes**:
- The `VITE_` prefix is required for any variable accessed by frontend code. Vite only exposes these at build time.
- `@vercel/postgres` expects `POSTGRES_URL` specifically (not `DATABASE_URL`). Vercel provides both in production, but for local development you must set `POSTGRES_URL` in your `.env` file.

## Important Code Locations

### `/api/run-scheduler.js` - Cron Worker Endpoint

This is the heart of the scheduling system:
- Called by GitHub Actions every 10 minutes
- Protected by Bearer token authentication
- Fetches posts scheduled for current time
- Decrypts user tokens, refreshes OAuth access tokens
- Posts to Reddit API, updates status in database

**Security**: Always validate `Authorization: Bearer ${SCHEDULER_AUTH_TOKEN}` header.

### Encryption Logic (Duplicated - Refactor Opportunity)

Encryption/decryption code is duplicated in:
- `/api/auth.js` - Encrypts tokens after OAuth
- `/api/run-scheduler.js` - Decrypts tokens before posting

**Consider**: Extract to `/lib/crypto.js` as shared utility.

### `/lib/db.js` - Database Abstractions

Repository pattern for all database operations:
- `saveUser()` - Upsert user with encrypted token
- `saveScheduledPost()` - Insert new scheduled post
- `getPendingPosts()` - Fetch posts ready to send
- `updatePostStatus()` - Mark as sent/failed

### `vite.config.js` - API Proxy

Proxies `/api/*` requests to `http://localhost:3000` during development. This allows the frontend to call API routes without CORS issues.

## Development Patterns & Conventions

### Client-Side Auth State

Authentication state is stored in `localStorage` (not cookies/sessions):
- User data stored after OAuth callback
- No server-side sessions (stateless design)
- Refresh tokens never stored client-side

### No Frontend Routing

Single-page app with no routing library:
- OAuth callback handled via URL parameters
- Simple conditional rendering in `App.jsx`

### Error Handling

All API routes use try-catch with user-friendly messages:
```javascript
try {
  // operation
  return new Response(JSON.stringify({ success: true }), { status: 200 });
} catch (error) {
  console.error('Error:', error);
  return new Response(JSON.stringify({ error: 'User-friendly message' }), { status: 500 });
}
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create `/api/your-endpoint.js`
2. Export default function with Request/Response pattern
3. Add to Vercel serverless build automatically (no config needed)

### Updating Database Schema

1. Create new SQL file in `/migrations/`
2. Run manually against Vercel Postgres
3. No rollback support - test locally first

### Modifying Scheduler Logic

Edit `/api/run-scheduler.js`:
- Query logic: Modify `getPendingPosts()` in `/lib/db.js`
- Reddit posting: Check Reddit API docs for endpoint changes
- Timing: Update `.github/workflows/scheduler.yml` cron expression

### Testing GitHub Actions Locally

GitHub Actions can't run locally. Options:
1. Manual testing: `curl -H "Authorization: Bearer $TOKEN" https://your-app.vercel.app/api/run-scheduler`
2. Use `act` tool (github.com/nektos/act) to simulate Actions
3. Deploy to Vercel preview, trigger workflow manually

## Important Notes

### Reddit API User-Agent

The User-Agent string is hardcoded in `/api/run-scheduler.js`:
```javascript
'User-Agent': 'RedditScheduler/1.0 by YourUsername'
```

**Update this** to your actual Reddit username to comply with Reddit API terms.

### Rate Limits

- **Reddit API**: 60 requests/minute
- **Vercel Functions (Free)**: 100GB-hours/month
- **GitHub Actions (Free)**: 2000 minutes/month

### Cron Frequency

GitHub Actions runs every 10 minutes (`*/10 * * * *`). Posts scheduled between cron runs will be sent at the next interval. For example, a post scheduled for 2:03 PM will be sent at 2:10 PM.

### OAuth State Validation

The OAuth flow stores a `state` parameter but **does not validate it** on callback. This is a security consideration for production use.

### Vercel Configuration

The `vercel.json` file uses a simplified modern configuration:
```json
{
  "version": 2,
  "routes": [...]
}
```

**Important**: Do NOT add a `builds` array to vercel.json. The deprecated `builds` configuration causes Vercel dev to try running the frontend dev server on random ports (e.g., 51000), leading to timeout errors during local development. Vercel automatically detects the Vite framework and API routes without explicit build configuration.

**If you see "Detecting port XXXXX timed out" errors**, it means a `builds` array was added - remove it immediately.

## Deployment Workflow

1. Push to GitHub → Vercel auto-deploys
2. Set environment variables in Vercel dashboard
3. Run `001_initial_schema.sql` in Vercel Postgres console
4. Update Reddit app redirect URI to match deployment URL
5. Configure GitHub Actions secrets (`SCHEDULER_API_URL`, `SCHEDULER_AUTH_TOKEN`)
6. Enable workflow in GitHub Actions tab

## Tech Stack

- **Frontend**: React 18.2, Vite 5.0
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Vercel Postgres
- **Hosting**: Vercel
- **Scheduler**: GitHub Actions
- **Auth**: Reddit OAuth 2.0
- **Encryption**: Native Node.js crypto (AES-256-CBC)

## No Tooling Configured

This project has:
- ✗ No tests
- ✗ No linting (ESLint, Prettier)
- ✗ No type checking (TypeScript)
- ✗ No CI/CD quality checks

Tests and linting should be added if the project scales beyond MVP.
