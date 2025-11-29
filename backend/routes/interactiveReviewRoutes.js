/**
 * Interactive Sentiment Review Route
 * GET  /api/interactive/negative-reviews/:index - Get next NEGATIVE review for manual verification
 * POST /api/interactive/negative-reviews/:id/sentiment - Update review sentiment
 * GET  /api/interactive/sentiment-breakdown - Get sentiment counts
 */

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Simple in-memory store for demonstration (can be replaced with MongoDB)
let reviewsData = [];
let hasLoadedFromDb = false;

/**
 * Load reviews from MongoDB on first request
 */
async function loadReviewsIfNeeded(db) {
  if (hasLoadedFromDb || !db) return;
  
  try {
    const reviewsCollection = db.collection('reviews');
    reviewsData = await reviewsCollection
      .find({ source: 'lemon8', sentiment: 'NEGATIVE' })
      .sort({ estate: 1 })
      .toArray();
    hasLoadedFromDb = true;
    console.log(`Loaded ${reviewsData.length} NEGATIVE reviews from MongoDB`);
  } catch (error) {
    console.error('Error loading reviews from MongoDB:', error);
  }
}

/**
 * Get next NEGATIVE review for manual verification
 */
router.get('/negative-reviews/:index', async (req, res) => {
  try {
    const db = req.app.locals.db;
    
    // Load from database if needed
    await loadReviewsIfNeeded(db);
    
    const index = parseInt(req.params.index) || 0;
    
    if (reviewsData.length === 0) {
      return res.json({
        completed: true,
        total: 0,
        message: 'No NEGATIVE reviews found or database unavailable'
      });
    }
    
    if (index >= reviewsData.length) {
      return res.json({
        completed: true,
        total: reviewsData.length,
        message: 'All NEGATIVE reviews reviewed'
      });
    }
    
    const review = reviewsData[index];
    
    res.json({
      index: index + 1,
      total: reviewsData.length,
      review: {
        _id: review._id.toString(),
        estate: review.estate,
        title: review.title,
        content: review.content,
        sentiment: review.sentiment,
        sentiment_score: review.sentiment_score
      }
    });
  } catch (error) {
    console.error('Error in /negative-reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update review sentiment
 */
router.post('/negative-reviews/:id/sentiment', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const reviewsCollection = db.collection('reviews');
    const { sentiment } = req.body;
    
    if (!['POSITIVE', 'NEUTRAL', 'NEGATIVE'].includes(sentiment)) {
      return res.status(400).json({ error: 'Invalid sentiment' });
    }
    
    try {
      const result = await reviewsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { sentiment, manually_reviewed_at: new Date() } }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }
      
      // Update local cache
      const reviewIndex = reviewsData.findIndex(r => r._id.toString() === req.params.id);
      if (reviewIndex >= 0) {
        reviewsData.splice(reviewIndex, 1);
      }
      
      res.json({ success: true, message: `Updated to ${sentiment}` });
    } catch (mongoError) {
      console.error('MongoDB error:', mongoError);
      res.status(500).json({ error: 'Database update failed' });
    }
  } catch (error) {
    console.error('Error updating sentiment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get sentiment breakdown
 */
router.get('/sentiment-breakdown', async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not available',
        total: 0,
        positive: 0,
        neutral: 0,
        negative: 0
      });
    }
    
    const reviewsCollection = db.collection('reviews');
    
    const breakdown = await reviewsCollection.aggregate([
      { $match: { source: 'lemon8' } },
      { $group: { _id: '$sentiment', count: { $sum: 1 } } }
    ]).toArray();
    
    const sentimentDict = {};
    breakdown.forEach(item => {
      sentimentDict[item._id] = item.count;
    });
    
    const total = await reviewsCollection.countDocuments({ source: 'lemon8' });
    
    res.json({
      total,
      positive: sentimentDict.POSITIVE || 0,
      neutral: sentimentDict.NEUTRAL || 0,
      negative: sentimentDict.NEGATIVE || 0
    });
  } catch (error) {
    console.error('Error in /sentiment-breakdown:', error);
    res.status(500).json({ 
      error: error.message,
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0
    });
  }
});

module.exports = router;