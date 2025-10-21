const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

// MongoDB connection options (match server.js)
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  family: 4
};

// GET /api/watchlist - returns the authenticated user's watchlist
router.get('/watchlist', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
      return res.status(500).json({ success: false, message: 'MongoDB configuration missing on server' });
    }

    const client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME);

      // Try matching user_id in a few common formats
      let watchlist = await db.collection('watchlists').findOne({ user_id: userId });
      if (!watchlist) {
        watchlist = await db.collection('watchlists').findOne({ user_id: String(userId) });
      }

      if (!watchlist) {
        return res.json({ success: true, watchlist: { user_id: userId, properties: [] } });
      }

      return res.json({ success: true, watchlist });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Watchlist endpoint error:', error.message || error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// POST /api/watchlist/add - add a property to the authenticated user's watchlist
router.post('/watchlist/add', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  const { flat_id, town, block, street_name, flat_type, note } = req.body;
  if (!flat_id) return res.status(400).json({ success: false, message: 'flat_id is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME);

      // Ensure watchlist exists for user
      const updateResult = await db.collection('watchlists').findOneAndUpdate(
        { user_id: userId },
        {
          $setOnInsert: { user_id: userId, created_at: new Date() },
          $push: { properties: { flat_id, town, block, street_name, flat_type, note, added_at: new Date() } }
        },
        { upsert: true, returnDocument: 'after' }
      );

      return res.json({ success: true, watchlist: updateResult.value });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Add watchlist error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// POST /api/watchlist/remove - remove a property from the authenticated user's watchlist
router.post('/watchlist/remove', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  const { flat_id } = req.body;
  if (!flat_id) return res.status(400).json({ success: false, message: 'flat_id is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB_NAME);

      const updateResult = await db.collection('watchlists').findOneAndUpdate(
        { user_id: userId },
        { $pull: { properties: { flat_id: flat_id } } },
        { returnDocument: 'after' }
      );

      return res.json({ success: true, watchlist: updateResult.value });
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error('Remove watchlist error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

module.exports = router;
