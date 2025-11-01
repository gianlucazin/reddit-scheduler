-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    refresh_token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS scheduled_posts (
    post_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    subreddit TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    link TEXT,
    schedule_time TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on schedule_time and status for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_time_status ON scheduled_posts(schedule_time, status);

-- Create index on user_id for efficient user queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON scheduled_posts(user_id);

