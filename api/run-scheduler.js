import { getPendingPosts, updatePostStatus } from '../lib/db.js'
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-cbc'
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET

function decrypt(text) {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY not configured')
  }
  const parts = text.split(':')
  const iv = Buffer.from(parts.shift(), 'hex')
  const encryptedText = Buffer.from(parts.join(':'), 'hex')
  // Convert hex string to buffer (64 hex chars = 32 bytes)
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex')
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}

async function refreshAccessToken(refreshToken) {
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'User-Agent': 'RedditScheduler/1.0 by YourUsername'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw new Error(`Token refresh failed: ${errorText}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

async function submitPostToReddit(accessToken, subreddit, title, text, url) {
  const formData = new URLSearchParams({
    sr: subreddit,
    title: title,
    kind: url ? 'link' : 'self',
    ...(url && { url }),
    ...(text && { text })
  })

  const response = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'RedditScheduler/1.0 by YourUsername'
    },
    body: formData.toString()
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Reddit API error: ${errorText}`)
  }

  const result = await response.json()
  return result
}

export default async function handler(req, res) {
  // Optional: Add authentication to prevent unauthorized calls
  const authToken = req.headers['authorization']
  const expectedToken = process.env.SCHEDULER_AUTH_TOKEN
  
  if (expectedToken && authToken !== `Bearer ${expectedToken}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!ENCRYPTION_KEY || !REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Server configuration incomplete' })
  }

  try {
    // Get all pending posts that are due
    const pendingPosts = await getPendingPosts()

    if (pendingPosts.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No posts to process',
        processed: 0 
      })
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    }

    for (const post of pendingPosts) {
      try {
        // Decrypt refresh token
        const refreshToken = decrypt(post.refresh_token)

        // Refresh access token
        const accessToken = await refreshAccessToken(refreshToken)

        // Submit post to Reddit
        await submitPostToReddit(
          accessToken,
          post.subreddit,
          post.title,
          post.body,
          post.link
        )

        // Update post status to 'sent'
        await updatePostStatus(post.post_id, 'sent')
        results.succeeded++
      } catch (error) {
        console.error(`Failed to process post ${post.post_id}:`, error)
        
        // Update post status to 'failed'
        await updatePostStatus(post.post_id, 'failed')
        results.failed++
        results.errors.push({
          postId: post.post_id,
          error: error.message
        })
      }
      results.processed++
    }

    return res.json({
      success: true,
      message: `Processed ${results.processed} posts`,
      ...results
    })
  } catch (error) {
    console.error('Scheduler error:', error)
    return res.status(500).json({ 
      error: 'Scheduler failed: ' + error.message 
    })
  }
}

