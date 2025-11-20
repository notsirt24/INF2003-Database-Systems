// ============================================
// Simple API to View MongoDB Data
// File: backend/test-api.js
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.MONGODB_DB_NAME || 'INF2006-Database_Systems'
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));

// News Article Schema (simplified for viewing)
const newsSchema = new mongoose.Schema({}, { strict: false, collection: 'newsarticles' });
const NewsArticle = mongoose.model('NewsArticle', newsSchema);

// Review Schema (simplified for viewing)
const reviewSchema = new mongoose.Schema({}, { strict: false, collection: 'reviews' });
const Review = mongoose.model('Review', reviewSchema);

// ============================================
// ROUTES TO VIEW DATA
// ============================================

// Home page - show available endpoints
app.get('/', (req, res) => {
  res.json({
    message: '📊 MongoDB Data Viewer API',
    endpoints: {
      news: {
        all: 'GET /api/news - Get all news articles',
        recent: 'GET /api/news?limit=5 - Get 5 most recent',
        byTown: 'GET /api/news?town=PUNGGOL - Filter by town',
        positive: 'GET /api/news?sentiment=positive - Filter by sentiment'
      },
      reviews: {
        all: 'GET /api/reviews - Get all reviews',
        recent: 'GET /api/reviews?limit=5 - Get 5 most recent',
        byTown: 'GET /api/reviews?town=PUNGGOL - Filter by town'
      },
      stats: {
        news: 'GET /api/stats/news - News statistics',
        reviews: 'GET /api/stats/reviews - Review statistics'
      }
    }
  });
});

// ============================================
// NEWS ROUTES
// ============================================

// Get all news articles with filters
app.get('/api/news', async (req, res) => {
  try {
    const { 
      limit = 20, 
      town, 
      sentiment,
      category 
    } = req.query;

    // Build query
    const query = { is_active: true };

    if (town) {
      query.locations = town.toUpperCase();
    }

    if (sentiment) {
      query['sentiment.label'] = sentiment;
    }

    if (category) {
      query.categories = category;
    }

    // Execute query
    const articles = await NewsArticle
      .find(query)
      .sort({ published_at: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      count: articles.length,
      articles: articles
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single news article
app.get('/api/news/:id', async (req, res) => {
  try {
    const article = await NewsArticle.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// REVIEW ROUTES
// ============================================

// Get all reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { 
      limit = 20, 
      town 
    } = req.query;

    const query = { status: 'approved' };

    if (town) {
      query.town = town.toUpperCase();
    }

    const reviews = await Review
      .find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      count: reviews.length,
      reviews: reviews
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STATISTICS ROUTES
// ============================================

// News statistics
app.get('/api/stats/news', async (req, res) => {
  try {
    const total = await NewsArticle.countDocuments({ is_active: true });
    
    // Sentiment distribution
    const sentiments = await NewsArticle.aggregate([
      { $match: { is_active: true } },
      { $group: {
        _id: '$sentiment.label',
        count: { $sum: 1 }
      }}
    ]);

    // Category distribution
    const categories = await NewsArticle.aggregate([
      { $match: { is_active: true } },
      { $unwind: '$categories' },
      { $group: {
        _id: '$categories',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Location distribution
    const locations = await NewsArticle.aggregate([
      { $match: { is_active: true } },
      { $unwind: '$locations' },
      { $group: {
        _id: '$locations',
        count: { $sum: 1 }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Impact distribution
    const impacts = await NewsArticle.aggregate([
      { $match: { is_active: true } },
      { $group: {
        _id: '$impact_assessment.predicted_impact',
        count: { $sum: 1 }
      }}
    ]);

    res.json({
      total_articles: total,
      sentiment_distribution: sentiments,
      top_categories: categories,
      top_locations: locations,
      impact_distribution: impacts
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Review statistics
app.get('/api/stats/reviews', async (req, res) => {
  try {
    const total = await Review.countDocuments({ status: 'approved' });
    
    // Rating distribution
    const ratings = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: {
        _id: '$rating',
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Average rating
    const avgRating = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: {
        _id: null,
        avg_rating: { $avg: '$rating' }
      }}
    ]);

    // Town distribution
    const towns = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: {
        _id: '$town',
        count: { $sum: 1 },
        avg_rating: { $avg: '$rating' }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      total_reviews: total,
      average_rating: avgRating[0]?.avg_rating?.toFixed(2) || 0,
      rating_distribution: ratings,
      top_towns: towns
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SEARCH ROUTE (Full text search)
// ============================================

app.get('/api/search', async (req, res) => {
  try {
    const { q, type = 'news' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    if (type === 'news') {
      const results = await NewsArticle.find({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ],
        is_active: true
      })
      .limit(20)
      .lean();

      res.json({ count: results.length, results });
    } else {
      const results = await Review.find({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { body: { $regex: q, $options: 'i' } }
        ],
        status: 'approved'
      })
      .limit(20)
      .lean();

      res.json({ count: results.length, results });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MongoDB Data Viewer API');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`💾 Database: ${process.env.MONGODB_DB_NAME}`);
  console.log('='.repeat(60));
  console.log('\n📖 Available Endpoints:');
  console.log('   GET  /                          - Home (list all endpoints)');
  console.log('   GET  /api/news                  - Get all news');
  console.log('   GET  /api/news?limit=5          - Get 5 recent news');
  console.log('   GET  /api/news?town=PUNGGOL     - News by town');
  console.log('   GET  /api/news?sentiment=positive - News by sentiment');
  console.log('   GET  /api/reviews               - Get all reviews');
  console.log('   GET  /api/stats/news            - News statistics');
  console.log('   GET  /api/stats/reviews         - Review statistics');
  console.log('   GET  /api/search?q=hdb&type=news - Search');
  console.log('='.repeat(60) + '\n');
});