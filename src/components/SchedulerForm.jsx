import React, { useState } from 'react'

function SchedulerForm({ user }) {
  const [subreddit, setSubreddit] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage('')

    // Validate required fields
    if (!subreddit || !title || !scheduleTime) {
      setMessage('Please fill in all required fields (Subreddit, Title, Schedule Time)')
      setIsSubmitting(false)
      return
    }

    // Validate schedule time is in the future
    const scheduleDate = new Date(scheduleTime)
    if (scheduleDate <= new Date()) {
      setMessage('Schedule time must be in the future')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          subreddit: subreddit.trim(),
          title: title.trim(),
          body: body.trim(),
          link: link.trim() || null,
          scheduleTime: scheduleDate.toISOString(),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('Post scheduled successfully!')
        // Reset form
        setSubreddit('')
        setTitle('')
        setBody('')
        setLink('')
        setScheduleTime('')
      } else {
        setMessage(data.error || 'Failed to schedule post')
      }
    } catch (error) {
      setMessage('Error scheduling post: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="scheduler-form-container">
      <form onSubmit={handleSubmit} className="scheduler-form">
        <div className="form-group">
          <label htmlFor="subreddit">Subreddit *</label>
          <input
            type="text"
            id="subreddit"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            placeholder="e.g., test"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="body">Body</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Post body text (optional)"
            rows={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="link">Link</label>
          <input
            type="url"
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com (optional)"
          />
        </div>

        <div className="form-group">
          <label htmlFor="scheduleTime">Schedule Time *</label>
          <input
            type="datetime-local"
            id="scheduleTime"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            required
          />
        </div>

        {message && (
          <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className="submit-btn">
          {isSubmitting ? 'Scheduling...' : 'Schedule Post'}
        </button>
      </form>
    </div>
  )
}

export default SchedulerForm

