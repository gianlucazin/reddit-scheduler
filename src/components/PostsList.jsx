import React, { useState, useEffect } from 'react'

function PostsList({ user, refreshTrigger }) {
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingPostId, setDeletingPostId] = useState(null)

  const fetchPosts = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/posts?userId=${user.userId}`)
      const data = await response.json()

      if (response.ok) {
        setPosts(data.posts || [])
      } else {
        setError(data.error || 'Failed to fetch posts')
      }
    } catch (err) {
      setError('Error fetching posts: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [user.userId, refreshTrigger])

  const handleDelete = async (postId) => {
    if (!confirm('Are you sure you want to delete this scheduled post?')) {
      return
    }

    setDeletingPostId(postId)

    try {
      const response = await fetch('/api/posts', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          postId: postId,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Remove the deleted post from the list
        setPosts(posts.filter(post => post.post_id !== postId))
      } else {
        alert(data.error || 'Failed to delete post')
      }
    } catch (err) {
      alert('Error deleting post: ' + err.message)
    } finally {
      setDeletingPostId(null)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-badge status-pending'
      case 'sent':
        return 'status-badge status-sent'
      case 'failed':
        return 'status-badge status-failed'
      default:
        return 'status-badge'
    }
  }

  if (isLoading) {
    return (
      <div className="posts-list-container">
        <h2>Scheduled Posts</h2>
        <p className="loading">Loading posts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="posts-list-container">
        <h2>Scheduled Posts</h2>
        <p className="error">{error}</p>
      </div>
    )
  }

  return (
    <div className="posts-list-container">
      <h2>Scheduled Posts</h2>

      {posts.length === 0 ? (
        <p className="no-posts">No scheduled posts yet. Create one to get started!</p>
      ) : (
        <div className="posts-list">
          {posts.map(post => (
            <div key={post.post_id} className="post-item">
              <div className="post-header">
                <span className="post-subreddit">r/{post.subreddit}</span>
                <span className={getStatusBadgeClass(post.status)}>
                  {post.status}
                </span>
              </div>

              <div className="post-title">{post.title}</div>

              <div className="post-footer">
                <span className="post-schedule-time">
                  {formatDate(post.schedule_time)}
                </span>

                {post.status === 'pending' && (
                  <button
                    onClick={() => handleDelete(post.post_id)}
                    disabled={deletingPostId === post.post_id}
                    className="delete-btn"
                  >
                    {deletingPostId === post.post_id ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PostsList
