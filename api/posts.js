import { getPostsByUserId, deletePost } from '../lib/db.js'
import { sql } from '@vercel/postgres'

export default async function handler(req, res) {
  // Get userId from query params for GET or body for DELETE
  const userId = req.method === 'GET' ? req.query.userId : req.body.userId

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' })
  }

  if (req.method === 'GET') {
    try {
      const posts = await getPostsByUserId(userId)
      return res.status(200).json({ success: true, posts })
    } catch (error) {
      console.error('Get posts error:', error)
      return res.status(500).json({ error: 'Failed to fetch posts: ' + error.message })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { postId } = req.body

      if (!postId) {
        return res.status(400).json({ error: 'Missing required field: postId' })
      }

      // First check if the post exists and belongs to the user
      const checkResult = await sql`
        SELECT status FROM scheduled_posts
        WHERE post_id = ${postId} AND user_id = ${userId}
      `

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Post not found or unauthorized' })
      }

      // Only allow deletion of pending posts
      if (checkResult.rows[0].status !== 'pending') {
        return res.status(403).json({ error: 'Can only delete pending posts' })
      }

      // Delete the post
      const deletedPost = await deletePost(postId, userId)

      if (!deletedPost) {
        return res.status(404).json({ error: 'Post not found' })
      }

      return res.status(200).json({ success: true, message: 'Post deleted successfully' })
    } catch (error) {
      console.error('Delete post error:', error)
      return res.status(500).json({ error: 'Failed to delete post: ' + error.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
