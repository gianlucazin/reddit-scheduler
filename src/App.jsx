import React, { useState, useEffect } from 'react'
import SchedulerForm from './components/SchedulerForm.jsx'
import PostsList from './components/PostsList.jsx'
import './styles/App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    // Check if user is authenticated on mount
    const storedUser = localStorage.getItem('reddit_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
      setIsAuthenticated(true)
    }

    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const auth = urlParams.get('auth')
    const userParam = urlParams.get('user')
    
    if (auth === 'success' && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam))
        localStorage.setItem('reddit_user', JSON.stringify(userData))
        setUser(userData)
        setIsAuthenticated(true)
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (e) {
        console.error('Failed to parse user data:', e)
      }
    }

    const error = urlParams.get('error')
    if (error) {
      alert('Authentication error: ' + decodeURIComponent(error))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleLogin = () => {
    // Get Reddit OAuth URL from environment or use default
    const redirectUri = import.meta.env.VITE_REDDIT_REDIRECT_URI || `${window.location.origin}/api/auth`
    const clientId = import.meta.env.VITE_REDDIT_CLIENT_ID
    
    if (!clientId) {
      alert('Reddit Client ID not configured. Please set VITE_REDDIT_CLIENT_ID in your environment.')
      return
    }

    const state = Math.random().toString(36).substring(7)
    localStorage.setItem('reddit_oauth_state', state)
    
    const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=submit,identity`
    
    window.location.href = authUrl
  }

  const handleLogout = () => {
    localStorage.removeItem('reddit_user')
    localStorage.removeItem('reddit_oauth_state')
    setUser(null)
    setIsAuthenticated(false)
  }

  const handlePostCreated = () => {
    // Trigger refresh of posts list
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Reddit Scheduler</h1>
        {isAuthenticated ? (
          <div className="user-info">
            <span>Logged in as: {user?.username}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        ) : (
          <button onClick={handleLogin} className="login-btn">Login with Reddit</button>
        )}
      </header>
      <main className="app-main">
        {isAuthenticated ? (
          <div className="content-grid">
            <SchedulerForm user={user} onPostCreated={handlePostCreated} />
            <PostsList user={user} refreshTrigger={refreshTrigger} />
          </div>
        ) : (
          <div className="login-prompt">
            <p>Please log in with Reddit to schedule posts.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App

