// Database utility functions
import { sql } from '@vercel/postgres'

export async function getUserByUserId(userId) {
  const result = await sql`
    SELECT * FROM users WHERE user_id = ${userId}
  `
  return result.rows[0]
}

export async function createOrUpdateUser(userId, refreshToken) {
  await sql`
    INSERT INTO users (user_id, refresh_token, updated_at)
    VALUES (${userId}, ${refreshToken}, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) 
    DO UPDATE SET refresh_token = ${refreshToken}, updated_at = CURRENT_TIMESTAMP
  `
}

export async function createScheduledPost(postData) {
  const { userId, subreddit, title, body, link, scheduleTime } = postData
  const result = await sql`
    INSERT INTO scheduled_posts (user_id, subreddit, title, body, link, schedule_time, status)
    VALUES (${userId}, ${subreddit}, ${title}, ${body || null}, ${link || null}, ${scheduleTime}, 'pending')
    RETURNING *
  `
  return result.rows[0]
}

export async function getPendingPosts() {
  const result = await sql`
    SELECT sp.*, u.refresh_token
    FROM scheduled_posts sp
    JOIN users u ON sp.user_id = u.user_id
    WHERE sp.schedule_time <= CURRENT_TIMESTAMP
    AND sp.status = 'pending'
    ORDER BY sp.schedule_time ASC
  `
  return result.rows
}

export async function updatePostStatus(postId, status) {
  await sql`
    UPDATE scheduled_posts
    SET status = ${status}, updated_at = CURRENT_TIMESTAMP
    WHERE post_id = ${postId}
  `
}

export async function getPostsByUserId(userId) {
  const result = await sql`
    SELECT post_id, user_id, subreddit, title, body, link, schedule_time, status, created_at, updated_at
    FROM scheduled_posts
    WHERE user_id = ${userId}
    ORDER BY schedule_time DESC
  `
  return result.rows
}

export async function deletePost(postId, userId) {
  const result = await sql`
    DELETE FROM scheduled_posts
    WHERE post_id = ${postId} AND user_id = ${userId}
    RETURNING *
  `
  return result.rows[0]
}

