// routes/reviews.js
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// Your MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'INF2006-Database_Systems';

let db;

// Initialize database connection
MongoClient.connect(MONGODB_URI)
    .then(client => {
        db = client.db(DB_NAME);
        console.log('✅ Connected to MongoDB for reviews');
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));

// GET /api/reviews/lemon8
router.get('/lemon8', async (req, res) => {
    try {
        const { estate, search, limit = 100 } = req.query;
        
        let query = { source: 'lemon8' };
        
        // Filter by estate (case-insensitive)
        if (estate) {
            query.estate = { $regex: new RegExp(`^${estate}$`, 'i') };
        }
        
        // Search in title or content
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { full_text: { $regex: search, $options: 'i' } }
            ];
        }
        
        console.log('📋 Lemon8 query:', JSON.stringify(query, null, 2));
        
        // Get database from app locals
        const db = req.app.locals.db;
        
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }
        
        const reviews = await db.collection('reviews')
            .find(query)
            .sort({ analyzed_at: -1 })
            .limit(parseInt(limit))
            .toArray();
        
        console.log(`[Lemon8] Found ${reviews.length} reviews for estate: ${estate || 'all'}`);
        
        res.json({ 
            success: true,
            data: reviews,
            count: reviews.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching Lemon8 reviews:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = router;