// performance-benchmark.js
// Database performance comparison for HDB Analytics Platform
// Compares PostgreSQL and MongoDB query performance across features

require('dotenv').config();
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const fs = require('fs');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

const results = {
  timestamp: new Date().toISOString(),
  postgresql: { tests: {}, summary: {} },
  mongodb: { tests: {}, summary: {} },
  comparison: {}
};

async function benchmarkPostgreSQL() {
  console.log('\n' + '='.repeat(70));
  console.log('POSTGRESQL PERFORMANCE BENCHMARK');
  console.log('='.repeat(70) + '\n');
  
  const client = await pgPool.connect();
  
  try {
    // Test 1: Dashboard statistics using materialized view
    console.log('Test 1: Dashboard Price Statistics');
    const t1_iter = 100;
    const t1_start = Date.now();
    
    for (let i = 0; i < t1_iter; i++) {
      await client.query(`
        SELECT month, avg_price, transaction_count, min_price, max_price
        FROM mv_monthly_price_stats
        WHERE town_id = (SELECT town_id FROM town WHERE name = 'TAMPINES')
          AND flat_type = '4 ROOM'
        ORDER BY month DESC
        LIMIT 24
      `);
    }
    
    const t1_time = Date.now() - t1_start;
    results.postgresql.tests.dashboard = {
      desc: 'Dashboard price statistics query',
      iterations: t1_iter,
      total_ms: t1_time,
      avg_ms: (t1_time / t1_iter).toFixed(2),
      qps: (1000 / (t1_time / t1_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t1_iter);
    console.log('   Total time: ' + t1_time + ' ms');
    console.log('   Average: ' + results.postgresql.tests.dashboard.avg_ms + ' ms');
    console.log('   QPS: ' + results.postgresql.tests.dashboard.qps + '\n');
    
    // Test 2: Complex JOIN query for listings
    console.log('Test 2: Listings Search with Filters');
    const t2_iter = 100;
    const t2_start = Date.now();
    
    for (let i = 0; i < t2_iter; i++) {
      await client.query(`
        SELECT rt.transaction_id, rt.contract_date, rt.resale_price,
               hf.flat_type, hf.floor_area_sqm, hb.block_no, hb.street_name,
               t.name AS town, EXTRACT(YEAR FROM rt.contract_date) AS year
        FROM resale_transaction rt
        JOIN hdbflat hf ON rt.flat_id = hf.flat_id
        JOIN hdbblock hb ON hf.block_id = hb.block_id
        JOIN town t ON hb.town_id = t.town_id
        WHERE t.name = 'BEDOK' AND hf.flat_type = '4 ROOM'
          AND rt.resale_price BETWEEN 400000 AND 600000
          AND EXTRACT(YEAR FROM rt.contract_date) >= 2020
        ORDER BY rt.contract_date DESC
        LIMIT 20
      `);
    }
    
    const t2_time = Date.now() - t2_start;
    results.postgresql.tests.listings = {
      desc: 'Complex JOIN query with filters',
      iterations: t2_iter,
      total_ms: t2_time,
      avg_ms: (t2_time / t2_iter).toFixed(2),
      qps: (1000 / (t2_time / t2_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t2_iter);
    console.log('   Total time: ' + t2_time + ' ms');
    console.log('   Average: ' + results.postgresql.tests.listings.avg_ms + ' ms');
    console.log('   QPS: ' + results.postgresql.tests.listings.qps + '\n');
    
    // Test 3: Watchlist retrieval
    console.log('Test 3: Watchlist Retrieval');
    const t3_iter = 100;
    const t3_start = Date.now();
    
    // Get a real user_id from the database first
    const userResult = await client.query(`SELECT user_id FROM "user" LIMIT 1`);
    const testUserId = userResult.rows.length > 0 ? userResult.rows[0].user_id : null;
    
    if (testUserId) {
      for (let i = 0; i < t3_iter; i++) {
        await client.query(`
          SELECT w.watchlist_id, w.flat_id, w.created_at,
                 hf.flat_type, hb.block_no, hb.street_name, t.name AS town,
                 rt.resale_price, rt.contract_date
          FROM watchlist w
          JOIN hdbflat hf ON w.flat_id = hf.flat_id
          JOIN hdbblock hb ON hf.block_id = hb.block_id
          JOIN town t ON hb.town_id = t.town_id
          LEFT JOIN resale_transaction rt ON rt.flat_id = hf.flat_id
          WHERE w.user_id = $1 AND w.is_active = true
          ORDER BY w.created_at DESC
          LIMIT 20
        `, [testUserId]);
      }
    } else {
      // If no users exist, just test the query structure without user filter
      for (let i = 0; i < t3_iter; i++) {
        await client.query(`
          SELECT w.watchlist_id, w.flat_id, w.created_at,
                 hf.flat_type, hb.block_no, hb.street_name, t.name AS town,
                 rt.resale_price, rt.contract_date
          FROM watchlist w
          JOIN hdbflat hf ON w.flat_id = hf.flat_id
          JOIN hdbblock hb ON hf.block_id = hb.block_id
          JOIN town t ON hb.town_id = t.town_id
          LEFT JOIN resale_transaction rt ON rt.flat_id = hf.flat_id
          WHERE w.is_active = true
          ORDER BY w.created_at DESC
          LIMIT 20
        `);
      }
    }
    
    const t3_time = Date.now() - t3_start;
    results.postgresql.tests.watchlist = {
      desc: 'User watchlist retrieval',
      iterations: t3_iter,
      total_ms: t3_time,
      avg_ms: (t3_time / t3_iter).toFixed(2),
      qps: (1000 / (t3_time / t3_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t3_iter);
    console.log('   Total time: ' + t3_time + ' ms');
    console.log('   Average: ' + results.postgresql.tests.watchlist.avg_ms + ' ms');
    console.log('   QPS: ' + results.postgresql.tests.watchlist.qps + '\n');
    
    // Test 4: Price prediction cache lookup
    console.log('Test 4: Price Prediction Cache');
    const t4_iter = 100;
    const t4_start = Date.now();
    
    for (let i = 0; i < t4_iter; i++) {
      await client.query(`
        SELECT prediction_id, town_id, flat_type, prediction_year,
               prediction_month, predicted_price, confidence_lower, confidence_upper
        FROM price_prediction
        WHERE town_id = (SELECT town_id FROM town WHERE name = 'TAMPINES')
          AND flat_type = '4 ROOM' AND prediction_year = 2030
          AND cache_valid_until > NOW()
        ORDER BY prediction_month
        LIMIT 12
      `);
    }
    
    const t4_time = Date.now() - t4_start;
    results.postgresql.tests.prediction = {
      desc: 'Price prediction cache query',
      iterations: t4_iter,
      total_ms: t4_time,
      avg_ms: (t4_time / t4_iter).toFixed(2),
      qps: (1000 / (t4_time / t4_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t4_iter);
    console.log('   Total time: ' + t4_time + ' ms');
    console.log('   Average: ' + results.postgresql.tests.prediction.avg_ms + ' ms');
    console.log('   QPS: ' + results.postgresql.tests.prediction.qps + '\n');
    
    // Test 5: Aggregation query
    console.log('Test 5: Town Statistics Aggregation');
    const t5_iter = 50;
    const t5_start = Date.now();
    
    for (let i = 0; i < t5_iter; i++) {
      await client.query(`
        SELECT t.name AS town, COUNT(*) AS total_transactions,
               ROUND(AVG(rt.resale_price)) AS avg_price,
               MIN(rt.resale_price) AS min_price,
               MAX(rt.resale_price) AS max_price
        FROM resale_transaction rt
        JOIN hdbflat hf ON rt.flat_id = hf.flat_id
        JOIN hdbblock hb ON hf.block_id = hb.block_id
        JOIN town t ON hb.town_id = t.town_id
        WHERE hf.flat_type = '4 ROOM' AND EXTRACT(YEAR FROM rt.contract_date) >= 2020
        GROUP BY t.name
        ORDER BY avg_price DESC
        LIMIT 10
      `);
    }
    
    const t5_time = Date.now() - t5_start;
    results.postgresql.tests.aggregation = {
      desc: 'Town comparison aggregation',
      iterations: t5_iter,
      total_ms: t5_time,
      avg_ms: (t5_time / t5_iter).toFixed(2),
      qps: (1000 / (t5_time / t5_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t5_iter);
    console.log('   Total time: ' + t5_time + ' ms');
    console.log('   Average: ' + results.postgresql.tests.aggregation.avg_ms + ' ms');
    console.log('   QPS: ' + results.postgresql.tests.aggregation.qps + '\n');
    
    // Get database statistics
    const sizeQuery = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
    `);
    
    const countQuery = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM resale_transaction) as transactions,
        (SELECT COUNT(*) FROM town) as towns,
        (SELECT COUNT(*) FROM hdbflat) as flats,
        (SELECT COUNT(*) FROM watchlist) as watchlist_items
    `);
    
    results.postgresql.summary = {
      database_size: sizeQuery.rows[0].db_size,
      total_transactions: parseInt(countQuery.rows[0].transactions),
      total_towns: parseInt(countQuery.rows[0].towns),
      total_flats: parseInt(countQuery.rows[0].flats),
      watchlist_items: parseInt(countQuery.rows[0].watchlist_items)
    };
    
    console.log('Database Statistics:');
    console.log('   Size: ' + sizeQuery.rows[0].db_size);
    console.log('   Transactions: ' + countQuery.rows[0].transactions);
    console.log('   Towns: ' + countQuery.rows[0].towns);
    console.log('   Flats: ' + countQuery.rows[0].flats);
    
  } finally {
    client.release();
  }
}

async function benchmarkMongoDB() {
  console.log('\n\n' + '='.repeat(70));
  console.log('MONGODB PERFORMANCE BENCHMARK');
  console.log('='.repeat(70) + '\n');
  
  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    // Test 1: Geospatial proximity for MRT stations
    console.log('Test 1: Geospatial Proximity Query (MRT)');
    const t1_iter = 100;
    const t1_start = Date.now();
    const coords = [103.9445, 1.3548];
    
    for (let i = 0; i < t1_iter; i++) {
      await db.collection('mrt_stations').find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: coords },
            $maxDistance: 1000
          }
        }
      }).limit(10).toArray();
    }
    
    const t1_time = Date.now() - t1_start;
    results.mongodb.tests.geospatial_mrt = {
      desc: 'Geospatial query for MRT stations',
      iterations: t1_iter,
      total_ms: t1_time,
      avg_ms: (t1_time / t1_iter).toFixed(2),
      qps: (1000 / (t1_time / t1_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t1_iter);
    console.log('   Total time: ' + t1_time + ' ms');
    console.log('   Average: ' + results.mongodb.tests.geospatial_mrt.avg_ms + ' ms');
    console.log('   QPS: ' + results.mongodb.tests.geospatial_mrt.qps + '\n');
    
    // Test 2: Schools proximity
    console.log('Test 2: Geospatial Proximity Query (Schools)');
    const t2_iter = 100;
    const t2_start = Date.now();
    
    for (let i = 0; i < t2_iter; i++) {
      await db.collection('schools').find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: coords },
            $maxDistance: 1000
          }
        }
      }).limit(10).toArray();
    }
    
    const t2_time = Date.now() - t2_start;
    results.mongodb.tests.geospatial_schools = {
      desc: 'Geospatial query for schools',
      iterations: t2_iter,
      total_ms: t2_time,
      avg_ms: (t2_time / t2_iter).toFixed(2),
      qps: (1000 / (t2_time / t2_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t2_iter);
    console.log('   Total time: ' + t2_time + ' ms');
    console.log('   Average: ' + results.mongodb.tests.geospatial_schools.avg_ms + ' ms');
    console.log('   QPS: ' + results.mongodb.tests.geospatial_schools.qps + '\n');
    
    // Test 3: Chat history retrieval
    console.log('Test 3: Chat History Retrieval');
    const t3_iter = 100;
    const t3_start = Date.now();
    
    // Get a real user_id from chat_logs if available
    const sampleLog = await db.collection('chat_logs').findOne({});
    const testUserId = sampleLog ? sampleLog.user_id : null;
    
    for (let i = 0; i < t3_iter; i++) {
      if (testUserId) {
        await db.collection('chat_logs').find({ user_id: testUserId })
          .sort({ created_at: -1 }).limit(20).toArray();
      } else {
        // If no user_id exists, just query recent chats
        await db.collection('chat_logs').find({})
          .sort({ created_at: -1 }).limit(20).toArray();
      }
    }
    
    const t3_time = Date.now() - t3_start;
    results.mongodb.tests.chat_history = {
      desc: 'Chat conversation history',
      iterations: t3_iter,
      total_ms: t3_time,
      avg_ms: (t3_time / t3_iter).toFixed(2),
      qps: (1000 / (t3_time / t3_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t3_iter);
    console.log('   Total time: ' + t3_time + ' ms');
    console.log('   Average: ' + results.mongodb.tests.chat_history.avg_ms + ' ms');
    console.log('   QPS: ' + results.mongodb.tests.chat_history.qps + '\n');
    
    // Test 4: Chat analytics aggregation
    console.log('Test 4: Chat Analytics Aggregation');
    const t4_iter = 50;
    const t4_start = Date.now();
    
    for (let i = 0; i < t4_iter; i++) {
      await db.collection('chat_logs').aggregate([
        {
          $group: {
            _id: '$intent',
            count: { $sum: 1 },
            avg_results: { $avg: '$data_count' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
    }
    
    const t4_time = Date.now() - t4_start;
    results.mongodb.tests.chat_analytics = {
      desc: 'Intent distribution aggregation',
      iterations: t4_iter,
      total_ms: t4_time,
      avg_ms: (t4_time / t4_iter).toFixed(2),
      qps: (1000 / (t4_time / t4_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t4_iter);
    console.log('   Total time: ' + t4_time + ' ms');
    console.log('   Average: ' + results.mongodb.tests.chat_analytics.avg_ms + ' ms');
    console.log('   QPS: ' + results.mongodb.tests.chat_analytics.qps + '\n');
    
    // Test 5: Review text search
    console.log('Test 5: Review Text Search');
    const t5_iter = 100;
    const t5_start = Date.now();
    
    for (let i = 0; i < t5_iter; i++) {
      await db.collection('community_reviews').find({
        $or: [
          { town: { $regex: 'TAMPINES', $options: 'i' } },
          { review_text: { $regex: 'convenient', $options: 'i' } }
        ],
        sentiment: 'positive'
      }).limit(20).toArray();
    }
    
    const t5_time = Date.now() - t5_start;
    results.mongodb.tests.review_search = {
      desc: 'Text search with regex',
      iterations: t5_iter,
      total_ms: t5_time,
      avg_ms: (t5_time / t5_iter).toFixed(2),
      qps: (1000 / (t5_time / t5_iter)).toFixed(2)
    };
    
    console.log('   Iterations: ' + t5_iter);
    console.log('   Total time: ' + t5_time + ' ms');
    console.log('   Average: ' + results.mongodb.tests.review_search.avg_ms + ' ms');
    console.log('   QPS: ' + results.mongodb.tests.review_search.qps + '\n');
    
    // Get database statistics
    const stats = await db.stats();
    const chatCount = await db.collection('chat_logs').countDocuments();
    const mrtCount = await db.collection('mrt_stations').countDocuments();
    const reviewCount = await db.collection('community_reviews').countDocuments();
    
    results.mongodb.summary = {
      database_size: (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB',
      total_collections: stats.collections,
      chat_logs: chatCount,
      mrt_stations: mrtCount,
      community_reviews: reviewCount
    };
    
    console.log('Database Statistics:');
    console.log('   Size: ' + (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB');
    console.log('   Collections: ' + stats.collections);
    console.log('   Chat logs: ' + chatCount);
    console.log('   MRT stations: ' + mrtCount);
    console.log('   Reviews: ' + reviewCount);
    
  } finally {
    await client.close();
  }
}

function generateComparison() {
  console.log('\n\n' + '='.repeat(70));
  console.log('PERFORMANCE COMPARISON');
  console.log('='.repeat(70) + '\n');
  
  const pgTests = Object.values(results.postgresql.tests);
  const mongoTests = Object.values(results.mongodb.tests);
  
  const pgAvg = pgTests.reduce((sum, t) => sum + parseFloat(t.avg_ms), 0) / pgTests.length;
  const mongoAvg = mongoTests.reduce((sum, t) => sum + parseFloat(t.avg_ms), 0) / mongoTests.length;
  
  results.comparison.overall = {
    postgresql_avg: pgAvg.toFixed(2),
    mongodb_avg: mongoAvg.toFixed(2),
    faster: pgAvg < mongoAvg ? 'PostgreSQL' : 'MongoDB',
    difference: Math.abs(((mongoAvg - pgAvg) / pgAvg) * 100).toFixed(2) + '%'
  };
  
  console.log('Overall Results:');
  console.log('   PostgreSQL average: ' + pgAvg.toFixed(2) + ' ms');
  console.log('   MongoDB average: ' + mongoAvg.toFixed(2) + ' ms');
  console.log('   Faster database: ' + results.comparison.overall.faster);
  console.log('   Performance difference: ' + results.comparison.overall.difference);
}

function exportResults() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = 'performance_results_' + timestamp + '.txt';
  
  const lines = [];
  lines.push('='.repeat(70));
  lines.push('HDB SMART ANALYTICS PLATFORM');
  lines.push('DATABASE PERFORMANCE BENCHMARK RESULTS');
  lines.push('Generated: ' + new Date().toLocaleString());
  lines.push('='.repeat(70));
  lines.push('');
  
  lines.push('POSTGRESQL RESULTS');
  lines.push('-'.repeat(70));
  Object.entries(results.postgresql.tests).forEach(([key, test]) => {
    lines.push('');
    lines.push('Test: ' + key);
    lines.push('  Description: ' + test.desc);
    lines.push('  Iterations: ' + test.iterations);
    lines.push('  Total time: ' + test.total_ms + ' ms');
    lines.push('  Average time: ' + test.avg_ms + ' ms');
    lines.push('  Queries per second: ' + test.qps);
  });
  
  lines.push('');
  lines.push('PostgreSQL Database Statistics:');
  lines.push('  Size: ' + results.postgresql.summary.database_size);
  lines.push('  Transactions: ' + results.postgresql.summary.total_transactions);
  lines.push('  Towns: ' + results.postgresql.summary.total_towns);
  lines.push('  Flats: ' + results.postgresql.summary.total_flats);
  lines.push('  Watchlist items: ' + results.postgresql.summary.watchlist_items);
  
  lines.push('');
  lines.push('');
  lines.push('MONGODB RESULTS');
  lines.push('-'.repeat(70));
  Object.entries(results.mongodb.tests).forEach(([key, test]) => {
    lines.push('');
    lines.push('Test: ' + key);
    lines.push('  Description: ' + test.desc);
    lines.push('  Iterations: ' + test.iterations);
    lines.push('  Total time: ' + test.total_ms + ' ms');
    lines.push('  Average time: ' + test.avg_ms + ' ms');
    lines.push('  Queries per second: ' + test.qps);
  });
  
  lines.push('');
  lines.push('MongoDB Database Statistics:');
  lines.push('  Size: ' + results.mongodb.summary.database_size);
  lines.push('  Collections: ' + results.mongodb.summary.total_collections);
  lines.push('  Chat logs: ' + results.mongodb.summary.chat_logs);
  lines.push('  MRT stations: ' + results.mongodb.summary.mrt_stations);
  lines.push('  Community reviews: ' + results.mongodb.summary.community_reviews);
  
  lines.push('');
  lines.push('');
  lines.push('PERFORMANCE COMPARISON');
  lines.push('-'.repeat(70));
  lines.push('PostgreSQL average response time: ' + results.comparison.overall.postgresql_avg + ' ms');
  lines.push('MongoDB average response time: ' + results.comparison.overall.mongodb_avg + ' ms');
  lines.push('Faster database: ' + results.comparison.overall.faster);
  lines.push('Performance difference: ' + results.comparison.overall.difference);
  
  lines.push('');
  lines.push('='.repeat(70));
  lines.push('END OF REPORT');
  lines.push('='.repeat(70));
  
  fs.writeFileSync(filename, lines.join('\n'));
  
  console.log('\n\nResults exported to: ' + filename);
}

async function runBenchmark() {
  console.log('\n' + '='.repeat(70));
  console.log('DATABASE PERFORMANCE BENCHMARK');
  console.log('HDB Smart Analytics Platform');
  console.log('='.repeat(70));
  console.log('Started: ' + new Date().toLocaleString());
  
  try {
    await benchmarkPostgreSQL();
    await benchmarkMongoDB();
    generateComparison();
    exportResults();
    
    console.log('\nBenchmark completed successfully');
  } catch (error) {
    console.error('Benchmark error:', error.message);
  } finally {
    await pgPool.end();
    console.log('Database connections closed\n');
  }
}

runBenchmark();