// backend/routes/newsRoutes.js
const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../database/scripts/.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'INF2006-Database_Systems';

// MongoDB connection options (matching your server.js)
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  family: 4, // Force IPv4
};

// Helper function to get MongoDB connection
async function getDatabase() {
    const client = new MongoClient(MONGODB_URI, mongoOptions);
    await client.connect();
    return { client, db: client.db(MONGODB_DB_NAME) };
}

/**
 * GET /api/news
 * Fetch all news articles with filtering, sorting, and pagination
 */
router.get('/', async (req, res) => {
    let client;
    
    try {
        const { client: mongoClient, db } = await getDatabase();
        client = mongoClient;
        
        const collection = db.collection('newsarticles');

        // Extract query parameters
        const {
            sourceType,      // ✅ CHANGED: Filter by source TYPE: 'government', 'property_portal', 'news_media'
            category,        // Filter by category
            sentiment,       // Filter by sentiment: 'positive', 'neutral', 'negative'
            location,        // Filter by location
            search,          // Search in title/description
            sortBy = 'published_at',  // Sort field
            order = 'desc',  // Sort order: 'asc' or 'desc'
            page = 1,        // Page number
            limit = 20       // Items per page
        } = req.query;

        // Build filter object
        const filter = { is_active: true };

        // ✅ CHANGED: Filter by source.type instead of source.name
        if (sourceType) {
            filter['source.type'] = sourceType;
        }

        if (category) {
            filter.categories = category;
        }

        if (sentiment) {
            filter['sentiment.label'] = sentiment;
        }

        if (location) {
            filter.locations = location;
        }

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOrder = order === 'asc' ? 1 : -1;

        // Execute query
        const articles = await collection
            .find(filter)
            .sort({ [sortBy]: sortOrder })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();

        // Get total count for pagination
        const total = await collection.countDocuments(filter);

        // Return response
        res.json({
            success: true,
            data: articles,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching news articles:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch news articles',
            message: error.message
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

/**
 * GET /api/news/stats
 * Get statistics about news articles
 */
router.get('/stats', async (req, res) => {
    let client;
    
    try {
        const { client: mongoClient, db } = await getDatabase();
        client = mongoClient;
        
        const collection = db.collection('newsarticles');

        // Get counts by source
        const bySource = await collection.aggregate([
            { $match: { is_active: true } },
            { $group: { _id: '$source.name', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();

        // Get counts by sentiment
        const bySentiment = await collection.aggregate([
            { $match: { is_active: true } },
            { $group: { _id: '$sentiment.label', count: { $sum: 1 } } }
        ]).toArray();

        // Get counts by category
        const byCategory = await collection.aggregate([
            { $match: { is_active: true } },
            { $unwind: '$categories' },
            { $group: { _id: '$categories', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Get top locations
        const byLocation = await collection.aggregate([
            { $match: { is_active: true } },
            { $unwind: '$locations' },
            { $group: { _id: '$locations', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        res.json({
            success: true,
            stats: {
                bySource,
                bySentiment,
                byCategory,
                byLocation,
                total: await collection.countDocuments({ is_active: true })
            }
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics',
            message: error.message
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

/**
 * GET /api/news/:id
 * Get a single news article by ID
 */
router.get('/:id', async (req, res) => {
    let client;
    
    try {
        const { client: mongoClient, db } = await getDatabase();
        client = mongoClient;
        
        const collection = db.collection('newsarticles');

        const article = await collection.findOne({ 
            article_id: req.params.id 
        });

        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'Article not found'
            });
        }

        // Increment view count
        await collection.updateOne(
            { article_id: req.params.id },
            { $inc: { view_count: 1 } }
        );

        res.json({
            success: true,
            data: article
        });

    } catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch article',
            message: error.message
        });
    } finally {
        if (client) {
            await client.close();
        }
    }
});

module.exports = router;