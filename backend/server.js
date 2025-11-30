const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser'); // for auth
const newsRoutes = require('./routes/newsRoutes');
require('dotenv').config({ path: '../database/scripts/.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// Allow multiple local frontend origins during development (adjust in production)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
].filter(Boolean);

// Temporary: Allow all origins for development
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  family: 4, // Force IPv4
};

// ============================================
// IMPORT ROUTES
// ============================================
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Listings (resale transactions)
const listingRoutes = require('./routes/listingRoutes');
app.use('/api/listings', listingRoutes);

// Watchlist routes (secure)
const watchlistRoutes = require('./routes/watchlistRoutes');
app.use('/api', watchlistRoutes);

// Map routes (MRT, Schools, Bus Stops, EV Charging)
const mapRoutes = require('./routes/mapRoutes');
app.use('/api/map', mapRoutes);

// Initialize MongoDB connection for reviews
let mongoDb = null;
async function initMongoDB() {
  try {
    const client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    await client.connect();
    mongoDb = client.db(process.env.MONGODB_DB_NAME);
    console.log('✅ MongoDB connected for reviews');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.log('⚠️ Server will continue without MongoDB - some features may not work');
    mongoDb = null;
    return false;
  }
}

// Pass MongoDB to reviews router via middleware
app.use((req, res, next) => {
  req.app.locals.db = mongoDb;
  next();
});

const reviewsRouter = require('./routes/reviews');
app.use('/api/reviews', reviewsRouter);

// Interactive Sentiment Review routes
const interactiveReviewRoutes = require('./routes/interactiveReviewRoutes');
app.use('/api/interactive', interactiveReviewRoutes);

const chatbotRoutes = require('./routes/chatbotRoutes');
app.use('/api/chatbot', chatbotRoutes);

// ============================================
// TEST ENDPOINTS (Optional - for debugging)
// ============================================

// PostgreSQL - List all tables with counts
app.get('/api/test-postgres', async (req, res) => {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

    pool.on('connect', (client) => {
    client.query("SET timezone = 'Asia/Singapore'");
  });
  
  try {
    const result = await pool.query(`
      SELECT 
        table_schema as schemaname,
        table_name as name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    res.json({ 
      success: true,
      tables: result.rows
    });
  } catch (error) {
    console.error('PostgreSQL error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await pool.end();
  }
});

// PostgreSQL - Get specific table data
app.get('/api/postgres-table/:tableName', async (req, res) => {
  const { tableName } = req.params;
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = $1
    `, [tableName]);
    
    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows.map(row => row.column_name);
    const dataResult = await pool.query(`SELECT * FROM "${tableName}" LIMIT 100`);
    
    res.json({
      success: true,
      columns: columns,
      rows: dataResult.rows
    });
  } catch (error) {
    console.error('PostgreSQL table error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    await pool.end();
  }
});

// MongoDB - List all collections with counts
app.get('/api/test-mongodb', async (req, res) => {
  let client;
  try {
    client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB_NAME);
    const collections = await db.listCollections().toArray();
    
    const collectionsWithCount = await Promise.all(
      collections.map(async (col) => ({
        name: col.name,
        count: await db.collection(col.name).countDocuments()
      }))
    );
    
    res.json({
      success: true,
      collections: collectionsWithCount
    });
  } catch (error) {
    console.error('MongoDB error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// MongoDB - Get specific collection data
app.get('/api/mongodb-collection/:collectionName', async (req, res) => {
  const { collectionName } = req.params;
  let client;
  
  try {
    client = new MongoClient(process.env.MONGODB_URI, mongoOptions);
    await client.connect();
    
    const db = client.db(process.env.MONGODB_DB_NAME);
    
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    
    const documents = await db.collection(collectionName)
      .find({})
      .limit(50)
      .toArray();
    
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('MongoDB collection error:', error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

app.use('/api/news', newsRoutes);

// ============================================
// DEBUG ENDPOINTS
// ============================================

// Check what estate names exist in Lemon8 reviews
app.get('/api/test-lemon8-estates', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        if (!db) {
            return res.status(500).json({ error: 'Database not initialized' });
        }
        
        // Get unique estate values
        const estates = await db.collection('reviews')
            .distinct('estate', { source: 'lemon8' });
        
        // Get count per estate
        const estateCounts = await db.collection('reviews')
            .aggregate([
                { $match: { source: 'lemon8' } },
                { $group: { _id: '$estate', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
            .toArray();
        
        res.json({
            success: true,
            totalLemon8Reviews: await db.collection('reviews').countDocuments({ source: 'lemon8' }),
            uniqueEstates: estates.length,
            estates: estates,
            estateCounts: estateCounts
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// AUTO-CLEANUP EXPIRED UNVERIFIED USERS
// ============================================
async function cleanupExpiredUsers() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(
      `DELETE FROM "user" 
       WHERE email_verified = FALSE 
       AND verification_code_expires < NOW()`
    );
    
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} expired unverified user(s)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up expired users:', error);
  } finally {
    await pool.end();
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredUsers, 5 * 60 * 1000);

// Run cleanup on server start
cleanupExpiredUsers();


// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Start server after MongoDB initialization
async function startServer() {
  console.log('🔗 Initializing MongoDB connection...');
  await initMongoDB();
  
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`🗺️ Map API: http://localhost:${PORT}/api/map`);
    console.log(`🤖 Chatbot API: http://localhost:${PORT}/api/chatbot`);
    console.log(`🔍 Test endpoints available at /api/test-postgres and /api/test-mongodb`);
    console.log(`📝 Reviews API: http://localhost:${PORT}/api/reviews`);
  });
}

startServer().catch(console.error);