const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser'); // for auth
require('dotenv').config({ path: '../database/scripts/.env' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
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
// IMPORT DASHBOARD ROUTES
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

// ============================================
// TEST ENDPOINTS (Optional - for debugging)
// ============================================

// PostgreSQL - List all tables with counts
app.get('/api/test-postgres', async (req, res) => {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/dashboard`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`🔍 Test endpoints available at /api/test-postgres and /api/test-mongodb`);
});