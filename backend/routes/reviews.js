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
        
        let query = {};
        
        // Filter by estate (case-insensitive)
        if (estate) {
            query.estate = { $regex: new RegExp(`^${estate}$`, 'i') };
        }
        
        // Search in title or content
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
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
        
        // Try multiple collections - processed reviews, raw posts, and community reviews
        let reviews = [];
        
        // First try the processed reviews collection
        try {
            const processedReviews = await db.collection('reviews')
                .find({ source: 'lemon8', ...query })
                .sort({ analyzed_at: -1 })
                .limit(parseInt(limit))
                .toArray();
            reviews.push(...processedReviews);
        } catch (err) {
            console.log('Reviews collection not found, trying other sources...');
        }
        
        // Try raw Lemon8 posts
        try {
            const rawPosts = await db.collection('lemon8_raw_posts')
                .find(query)
                .sort({ created_at: -1 })
                .limit(parseInt(limit) - reviews.length)
                .toArray();
            reviews.push(...rawPosts);
        } catch (err) {
            console.log('Raw posts collection not found...');
        }
        
        // Try community reviews
        try {
            const communityReviews = await db.collection('community_reviews')
                .find(query)
                .sort({ created_at: -1 })
                .limit(parseInt(limit) - reviews.length)
                .toArray();
            reviews.push(...communityReviews);
        } catch (err) {
            console.log('Community reviews collection not found...');
        }
        
        // Sort all reviews by creation date
        reviews.sort((a, b) => {
            const aDate = new Date(a.created_at || a.analyzed_at || 0);
            const bDate = new Date(b.created_at || b.analyzed_at || 0);
            return bDate - aDate;
        });
        
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

// POST /api/reviews/lemon8 - Create a new community review
router.post('/lemon8', async (req, res) => {
    try {
        const { 
            title, 
            content, 
            estate, 
            rating,
            amenities,
            author_name,
            account_handle,
            postAnonymously
        } = req.body;
        
        console.log('📝 POST /api/reviews/lemon8 - New review request');
        console.log('🏢 Estate:', estate);
        console.log('🎯 Amenities received:', amenities);
        console.log('📋 Full request body:', JSON.stringify(req.body, null, 2));
        


        // Validation
        if (!title || !content || !estate) {
            return res.status(400).json({ 
                success: false,
                error: 'Title, content, and estate are required' 
            });
        }

        const db = req.app.locals.db;
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }

        // Determine the author name based on anonymous choice and provided data
        let finalAuthorName;
        if (postAnonymously === true) {
            finalAuthorName = 'Anonymous';
        } else if (author_name && author_name.trim()) {
            finalAuthorName = author_name.trim();
        } else {
            finalAuthorName = 'Anonymous';
        }

        // Create new community review document
        const newReview = {
            title: title.trim(),
            content: content.trim(),
            estate: estate.trim(),
            rating: rating || 5,
            amenities_mentioned: amenities || [],
            author_name: finalAuthorName, // Will be actual username or 'Anonymous' based on choice
            account_handle: account_handle?.trim() || 'community_user', // Always real email for filtering, even when anonymous
            
            // Auto-generated fields
            created_at: new Date(),
            source: 'community',
            sentiment: rating >= 4 ? 'positive' : (rating >= 3 ? 'neutral' : 'negative'),
            ai_confidence: 0.95, // High confidence for user-submitted ratings
            
            // Community post fields
            url: null, // Community posts don't have external URLs
            likes_count: 0,
            
            // Mark as community-generated
            is_community_post: true,
            status: 'published'
        };

        // Log the complete document before insertion
        console.log('📄 Complete MongoDB document to be inserted:');
        console.log(JSON.stringify(newReview, null, 2));
        
        // Insert into MongoDB
        const result = await db.collection('community_reviews').insertOne(newReview);
        
        console.log(`✅ Created new community review: ${result.insertedId}`);
        console.log(`📊 Document inserted with _id: ${result.insertedId}`);

        res.status(201).json({ 
            success: true,
            data: {
                _id: result.insertedId,
                ...newReview
            },
            message: 'Community review created successfully!'
        });

    } catch (error) {
        console.error('❌ Error creating community review:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// GET /api/reviews/user/:email - Get reviews by user email
router.get('/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ 
                success: false,
                error: 'Email parameter is required' 
            });
        }

        const db = req.app.locals.db;
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }

        // Find community reviews by account_handle (email)
        const userReviews = await db.collection('community_reviews')
            .find({ account_handle: email })
            .sort({ created_at: -1 }) // Most recent first
            .toArray();

        res.json({ 
            success: true,
            data: userReviews,
            count: userReviews.length
        });

    } catch (error) {
        console.error('❌ Error fetching user reviews:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// PUT /api/reviews/user/:id - Update user's review
router.put('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, estate, rating, amenities, author_name, account_handle, postAnonymously } = req.body;
        
        console.log('🔄 PUT /api/reviews/user/:id - Update request received');
        console.log('📝 Review ID:', id);
        console.log('📋 Request body:', JSON.stringify(req.body, null, 2));

        if (!id) {
            return res.status(400).json({ 
                success: false,
                error: 'Review ID is required' 
            });
        }

        const db = req.app.locals.db;
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }

        // Handle author name based on postAnonymously flag
        let finalAuthorName;
        if (postAnonymously === true) {
            finalAuthorName = 'Anonymous';
        } else if (author_name && author_name.trim()) {
            finalAuthorName = author_name.trim();
        } else {
            finalAuthorName = 'Anonymous';
        }
        
        const updateData = {
            title: title?.trim(),
            content: content?.trim(), 
            estate: estate?.trim(),
            rating: rating || 5,
            amenities_mentioned: amenities || [],
            author_name: finalAuthorName,
            account_handle: account_handle?.trim() || 'community_user',
            updated_at: new Date(),
            sentiment: rating >= 4 ? 'positive' : (rating >= 3 ? 'neutral' : 'negative')
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => 
            updateData[key] === undefined && delete updateData[key]
        );

        const result = await db.collection('community_reviews').updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Review not found' 
            });
        }

        res.json({ 
            success: true,
            message: 'Review updated successfully' 
        });

    } catch (error) {
        console.error('❌ Error updating review:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// DELETE /api/reviews/user/:id - Delete user's review
router.delete('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ 
                success: false,
                error: 'Review ID is required' 
            });
        }

        const db = req.app.locals.db;
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }

        const result = await db.collection('community_reviews').deleteOne(
            { _id: new ObjectId(id) }
        );

        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Review not found' 
            });
        }

        res.json({ 
            success: true,
            message: 'Review deleted successfully' 
        });

    } catch (error) {
        console.error('❌ Error deleting review:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// GET /api/reviews/lemon8/stats - Get area statistics
router.get('/lemon8/stats', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }
        
        // Get aggregated stats by estate from both collections
        const statsFromReviews = await db.collection('reviews').aggregate([
            { $match: { source: 'lemon8', estate: { $exists: true, $ne: null } } },
            { 
                $group: { 
                    _id: '$estate',
                    count: { $sum: 1 },
                    positiveCount: { 
                        $sum: { 
                            $cond: [
                                { $or: [
                                    { $eq: ['$sentiment', 'POSITIVE'] },
                                    { $eq: ['$sentiment', 'positive'] }
                                ]}, 
                                1, 
                                0
                            ] 
                        }
                    },
                    negativeCount: { 
                        $sum: { 
                            $cond: [
                                { $or: [
                                    { $eq: ['$sentiment', 'NEGATIVE'] },
                                    { $eq: ['$sentiment', 'negative'] }
                                ]}, 
                                1, 
                                0
                            ] 
                        }
                    }
                }
            }
        ]).toArray();
        
        const statsFromRaw = await db.collection('lemon8_raw_posts').aggregate([
            { $match: { estate: { $exists: true, $ne: null } } },
            { 
                $group: { 
                    _id: '$estate',
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        
        // Combine stats and calculate ratings
        const combinedStats = {};
        
        // Process processed reviews stats
        statsFromReviews.forEach(stat => {
            const estate = stat._id;
            const positive = stat.positiveCount || 0;
            const negative = stat.negativeCount || 0;
            const total = stat.count || 0;
            
            // Calculate rating based on sentiment ratio
            let rating = 3.0; // Default neutral
            let positiveRatio = 0;
            let negativeRatio = 0;
            
            if (total > 0) {
                positiveRatio = positive / total;
                negativeRatio = negative / total;
                
                if (positiveRatio > 0.6) rating = 4.5;
                else if (positiveRatio > 0.4) rating = 4.0;
                else if (negativeRatio > 0.6) rating = 2.0;
                else if (negativeRatio > 0.4) rating = 2.5;
                else rating = 3.5;
            }
            
            combinedStats[estate] = {
                estate,
                count: total,
                rating: parseFloat(rating.toFixed(1)),
                trend: positiveRatio > negativeRatio ? 'up' : (positiveRatio < negativeRatio ? 'down' : 'stable')
            };
        });
        
        // Add raw posts counts
        statsFromRaw.forEach(stat => {
            const estate = stat._id;
            if (!combinedStats[estate]) {
                combinedStats[estate] = {
                    estate,
                    count: stat.count,
                    rating: 3.0,
                    trend: 'stable'
                };
            } else {
                // Add raw count to processed count if both exist
                combinedStats[estate].totalRaw = stat.count;
            }
        });
        
        res.json({ 
            success: true,
            data: Object.values(combinedStats),
            count: Object.keys(combinedStats).length
        });
        
    } catch (error) {
        console.error('❌ Error fetching Lemon8 stats:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// GET /api/reviews/debug/mongo - Debug endpoint to check MongoDB structure
router.get('/debug/mongo', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        if (!db) {
            return res.status(500).json({ 
                success: false,
                error: 'Database not initialized' 
            });
        }

        // Get database and collection info
        const collections = await db.listCollections().toArray();
        
        // Get sample documents from community_reviews
        const communityReviews = await db.collection('community_reviews').find({}).limit(3).toArray();
        
        // Get sample documents from reviews (Lemon8 data)
        const lemon8Reviews = await db.collection('reviews').find({}).limit(3).toArray();
        
        // Get counts
        const communityCount = await db.collection('community_reviews').countDocuments();
        const lemon8Count = await db.collection('reviews').countDocuments();

        res.json({
            success: true,
            database_name: db.databaseName,
            collections: collections.map(col => col.name),
            stats: {
                community_reviews_count: communityCount,
                lemon8_reviews_count: lemon8Count
            },
            sample_data: {
                community_reviews: communityReviews,
                lemon8_reviews: lemon8Reviews
            }
        });

    } catch (error) {
        console.error('❌ Error checking MongoDB:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

module.exports = router;