import { createScheduledPost } from '../lib/db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { subreddit, title, body, link, scheduleTime } = req.body

    // Validate required fields
    if (!subreddit || !title || !scheduleTime) {
      return res.status(400).json({ error: 'Missing required fields: subreddit, title, scheduleTime' })
    }

    // Get user from request body (sent from frontend)
    const userId = req.body.userId

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }

    // Validate schedule time is in the future
    const scheduleDate = new Date(scheduleTime)
    if (scheduleDate <= new Date()) {
      return res.status(400).json({ error: 'Schedule time must be in the future' })
    }

    // Create scheduled post
    const post = await createScheduledPost({
      userId,
      subreddit: subreddit.trim(),
      title: title.trim(),
      body: body?.trim() || null,
      link: link?.trim() || null,
      scheduleTime: scheduleDate.toISOString()
    })

    return res.status(201).json({
      success: true,
      post: {
        postId: post.post_id,
        subreddit: post.subreddit,
        title: post.title,
        scheduleTime: post.schedule_time
      }
    })
  } catch (error) {
    console.error('Schedule error:', error)
    return res.status(500).json({ error: 'Failed to schedule post: ' + error.message })
  }
}

