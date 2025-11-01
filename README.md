# Zero-Cost Reddit Scheduler

A free-to-host Reddit post scheduler built with React, Vercel serverless functions, Vercel Postgres, and GitHub Actions.

## Features

- 🔐 Reddit OAuth authentication
- 📅 Schedule Reddit posts for future dates
- 🔄 Automatic posting via GitHub Actions cron job
- 💾 Secure token storage with encryption
- 🆓 Free hosting on Vercel Hobby plan

## Architecture

- **Frontend**: React + Vite deployed on Vercel
- **Backend**: Vercel serverless functions (Node.js)
- **Database**: Vercel Postgres (Hobby plan)
- **Scheduler**: GitHub Actions workflow running every 10 minutes

## Prerequisites

- Node.js 18+ installed locally
- A Reddit account
- A GitHub account
- A Vercel account

## Setup Instructions

### 1. Create a Reddit App

1. Go to https://www.reddit.com/prefs/apps
2. Click "create another app..." or "create app"
3. Fill in:
   - **Name**: Reddit Scheduler (or any name)
   - **App type**: "web app"
   - **Redirect URI**: `https://your-project.vercel.app/api/auth` (update after deployment)
   - **Description**: (optional)
4. Note your **Client ID** (under the app name) and **Secret** (listed as "secret")

### 2. Clone and Install

```bash
git clone <your-repo-url>
cd reddit-scheduler
npm install
```

### 3. Set Up Vercel Postgres

1. Go to your Vercel dashboard
2. Create a new project or select existing
3. Go to Storage → Create Database → Postgres
4. Select Hobby plan (free tier)
5. Note the connection string (auto-populated as `DATABASE_URL`)

### 4. Run Database Migrations

1. In Vercel dashboard, go to your Postgres database
2. Open the SQL Editor
3. Copy and paste the contents of `migrations/001_initial_schema.sql`
4. Execute the SQL to create tables

### 5. Configure Environment Variables

In your Vercel project settings, add these environment variables:

**Required:**

- `REDDIT_CLIENT_ID`: Your Reddit app client ID
- `REDDIT_CLIENT_SECRET`: Your Reddit app client secret
- `REDDIT_REDIRECT_URI`: `https://your-project.vercel.app/api/auth` (update with your domain)
- `ENCRYPTION_KEY`: A random 32-byte hex string (generate with: `openssl rand -hex 32`)
- `SCHEDULER_AUTH_TOKEN`: A random token for securing the scheduler endpoint (generate with: `openssl rand -hex 32`)

**Auto-provided by Vercel:**

- `DATABASE_URL`: Automatically set when you create Postgres database
- `VERCEL_URL`: Automatically set during deployment

**For local development**, copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your actual values:

```env
VITE_REDDIT_CLIENT_ID=your_client_id
VITE_REDDIT_REDIRECT_URI=http://localhost:5173/api/auth
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret
REDDIT_REDIRECT_URI=http://localhost:5173/api/auth
ENCRYPTION_KEY=your_encryption_key
DATABASE_URL=your_database_url
SCHEDULER_AUTH_TOKEN=your_scheduler_auth_token
```

### 6. Deploy to Vercel

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Deploy
vercel

# Follow prompts to link your project
```

### 7. Update Reddit Redirect URI

After deployment, update your Reddit app's redirect URI to match your Vercel URL:
`https://your-project.vercel.app/api/auth`

### 8. Set Up GitHub Actions

1. Go to your GitHub repository settings
2. Navigate to Secrets and variables → Actions
3. Add the following secrets:
   - `SCHEDULER_API_URL`: `https://your-project.vercel.app/api/run-scheduler`
   - `SCHEDULER_AUTH_TOKEN`: Same value as `SCHEDULER_AUTH_TOKEN` in Vercel

### 9. Test the Application

1. Visit your deployed app
2. Click "Login with Reddit"
3. Authorize the app
4. Fill in the form and schedule a post
5. Wait for the scheduled time (or trigger manually via GitHub Actions)

## Manual Testing

### Test the Scheduler Manually

1. Go to your GitHub repository
2. Navigate to Actions → Reddit Scheduler Cron
3. Click "Run workflow" to manually trigger the scheduler

### Test Locally

For local development with both frontend and API functions working:

**Option 1: Full Local Testing (Recommended)**

1. **Terminal 1 - Start Vercel dev server (for API functions):**

   ```bash
   vercel dev
   ```

   This starts the serverless functions on `http://localhost:3000`

2. **Terminal 2 - Start Vite dev server (for frontend):**

   ```bash
   npm run dev
   ```

   This starts the React app on `http://localhost:5173` and proxies API calls to Vercel

3. Visit `http://localhost:5173` in your browser

**Option 2: Frontend Only Testing**

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:5173
# Note: API functions won't work locally with this approach - test them after deployment
```

## Project Structure

```
reddit-scheduler/
├── src/
│   ├── App.jsx                 # Main app component
│   ├── main.jsx                # React entry point
│   ├── components/
│   │   └── SchedulerForm.jsx   # Post scheduling form
│   └── styles/
│       └── App.css             # Application styles
├── api/
│   ├── auth.js                 # Reddit OAuth handler
│   ├── schedule.js             # Save scheduled posts
│   └── run-scheduler.js        # Worker function (called by cron)
├── lib/
│   └── db.js                   # Database utility functions
├── migrations/
│   └── 001_initial_schema.sql   # Database schema
├── .github/
│   └── workflows/
│       └── scheduler.yml       # GitHub Actions cron job
├── package.json
├── vite.config.js
├── vercel.json
└── README.md
```

## API Endpoints

### `GET /api/auth`

Handles Reddit OAuth callback. Redirects user after authentication.

### `POST /api/schedule`

Saves a scheduled post to the database.

**Request body:**

```json
{
  "userId": "string",
  "subreddit": "string",
  "title": "string",
  "body": "string (optional)",
  "link": "string (optional)",
  "scheduleTime": "ISO 8601 timestamp"
}
```

### `GET /api/run-scheduler`

Worker function that processes pending posts. Called by GitHub Actions cron.

**Headers:**

- `Authorization: Bearer <SCHEDULER_AUTH_TOKEN>`

## Database Schema

### `users` table

- `user_id` (TEXT, PRIMARY KEY): Reddit username
- `refresh_token` (TEXT): Encrypted Reddit refresh token
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### `scheduled_posts` table

- `post_id` (SERIAL, PRIMARY KEY)
- `user_id` (TEXT, FOREIGN KEY): References users.user_id
- `subreddit` (TEXT)
- `title` (TEXT)
- `body` (TEXT, nullable)
- `link` (TEXT, nullable)
- `schedule_time` (TIMESTAMP)
- `status` (TEXT): 'pending', 'sent', or 'failed'
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Troubleshooting

### OAuth not working

- Verify `REDDIT_REDIRECT_URI` matches your Reddit app settings exactly
- Check that `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are correct

### Posts not being scheduled

- Check database connection and verify tables exist
- Check Vercel function logs for errors
- Verify `ENCRYPTION_KEY` is set correctly

### Cron job not running

- Verify GitHub Actions secrets are set
- Check GitHub Actions workflow logs
- Ensure `SCHEDULER_AUTH_TOKEN` matches in both Vercel and GitHub

### Posts not posting

- Check Vercel function logs for `api/run-scheduler`
- Verify Reddit refresh tokens are valid
- Check Reddit API rate limits

## Security Notes

- Refresh tokens are encrypted before storage
- Scheduler endpoint is protected by authentication token
- All secrets stored as environment variables
- HTTPS enforced on Vercel

## Limitations

- Reddit API rate limits apply (60 requests per minute)
- Free tier Vercel functions have execution time limits
- GitHub Actions free tier has 2000 minutes/month limit (sufficient for 10-minute cron)

## License

MIT
