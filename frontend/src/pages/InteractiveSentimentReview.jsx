import React, { useState, useEffect } from 'react';
import './InteractiveSentimentReview.css';

export default function InteractiveSentimentReview() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [breakdown, setBreakdown] = useState(null);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ reviewed: 0, changed: 0 });
  const [mongoAvailable, setMongoAvailable] = useState(true);

  useEffect(() => {
    loadNextReview();
    loadBreakdown();
    
    // Check if MongoDB is available
    setTimeout(() => {
      checkMongoAvailability();
    }, 1000);
  }, []);
  
  const checkMongoAvailability = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/interactive/sentiment-breakdown');
      if (!response.ok) {
        setMongoAvailable(false);
      }
    } catch (error) {
      setMongoAvailable(false);
      console.log('Backend not available');
    }
  };

  const loadNextReview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/interactive/negative-reviews/${currentIndex}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.completed) {
        setCompleted(true);
        setMessage(`All ${data.total} NEGATIVE reviews reviewed!`);
      } else {
        setReview(data.review);
        setMessage('');
      }
    } catch (error) {
      setMessage(`Error loading review: ${error.message}`);
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBreakdown = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/interactive/sentiment-breakdown');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setBreakdown(data);
    } catch (error) {
      console.error('Error loading breakdown:', error);
    }
  };

  const handleSentimentChoice = async (sentiment) => {
    if (!review) return;
    
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/interactive/negative-reviews/${review._id}/sentiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentiment })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMessage(`✅ Updated to ${sentiment}`);
        if (sentiment !== review.sentiment) {
          setStats(prev => ({ ...prev, changed: prev.changed + 1 }));
        }
        setStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
        
        // Load next review
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          loadNextReview();
          loadBreakdown();
        }, 500);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
      console.error('Update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    setCurrentIndex(currentIndex + 1);
    loadNextReview();
  };

  if (!mongoAvailable) {
    return (
      <div className="sentiment-review-container">
        <div className="error-card">
          <h2>⚠️ Backend Connection Issue</h2>
          <p>The interactive review tool is having trouble connecting to the database.</p>
          
          <div className="instructions">
            <h3>Current Status:</h3>
            <ul>
              <li>✅ Backend running on port 3001</li>
              <li>⚠️ MongoDB connection failed</li>
              <li>💡 You can still test the interface</li>
            </ul>
            
            <h3>To fix MongoDB:</h3>
            <ol>
              <li>Install and start MongoDB locally</li>
              <li>Or use MongoDB Atlas cloud service</li>
              <li>Update .env with correct MONGODB_URI</li>
            </ol>
          </div>
          
          <button onClick={() => window.location.reload()} className="reload-btn">
            Reload & Try Again
          </button>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="sentiment-review-container">
        <div className="completion-card">
          <h2>✅ Review Complete!</h2>
          <div className="stats">
            <p>Reviews Reviewed: <strong>{stats.reviewed}</strong></p>
            <p>Changes Made: <strong>{stats.changed}</strong></p>
          </div>
          <div className="breakdown-summary">
            <h3>Current Breakdown</h3>
            {breakdown && (
              <ul>
                <li>POSITIVE: <strong>{breakdown.positive}</strong></li>
                <li>NEUTRAL: <strong>{breakdown.neutral}</strong></li>
                <li>NEGATIVE: <strong>{breakdown.negative}</strong></li>
                <li>TOTAL: <strong>{breakdown.total}</strong></li>
              </ul>
            )}
          </div>
          <button onClick={() => window.location.reload()} className="reload-btn">
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!review || loading) {
    return (
      <div className="sentiment-review-container">
        <div className="loading-card">
          <div className="spinner"></div>
          <p>Loading review...</p>
          <small>Connecting to backend on port 3001</small>
        </div>
      </div>
    );
  }

  return (
    <div className="sentiment-review-container">
      <div className="review-card">
        <div className="review-header">
          <h2>Interactive Sentiment Review</h2>
          <p className="progress">Review {currentIndex + 1}</p>
        </div>

        <div className="review-content">
          <div className="estate-badge">{review.estate}</div>
          
          <h3>{review.title}</h3>
          <p className="review-text">{review.content}</p>
          
          <div className="sentiment-info">
            <span className="current-sentiment">
              Current: <strong>{review.sentiment}</strong>
            </span>
            <span className="sentiment-score">
              Score: {review.sentiment_score?.toFixed(3)}
            </span>
          </div>
        </div>

        <div className="action-section">
          <p className="prompt">Is this review truly NEGATIVE?</p>
          
          <div className="button-group">
            <button 
              onClick={() => handleSentimentChoice('POSITIVE')}
              className="btn btn-positive"
              disabled={loading}
            >
              ➕ POSITIVE
            </button>
            <button 
              onClick={() => handleSentimentChoice('NEUTRAL')}
              className="btn btn-neutral"
              disabled={loading}
            >
              ➖ NEUTRAL
            </button>
            <button 
              onClick={() => handleSentimentChoice('NEGATIVE')}
              className="btn btn-negative"
              disabled={loading}
            >
              ✓ NEGATIVE
            </button>
          </div>
          
          <button 
            onClick={handleSkip}
            className="btn btn-skip"
            disabled={loading}
          >
            ⏭️ Skip
          </button>
        </div>

        {message && <div className="message">{message}</div>}

        <div className="breakdown-mini">
          {breakdown && (
            <>
              <span>POSITIVE: {breakdown.positive}</span>
              <span>NEUTRAL: {breakdown.neutral}</span>
              <span>NEGATIVE: {breakdown.negative}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}