// backend/routes/chatbotRoutes.js

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');
const { extractIntentAndFilters, generateAnswer, generateSmartAlternatives } = require('../services/llmService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Singapore'");
});

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.split(' ')[1];
}

function getUserIdFromRequest(req) {
  const token = getTokenFromHeader(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    return decoded.user_id || null;
  } catch (err) {
    return null;
  }
}

async function getAvailableTowns() {
  const client = await pool.connect();
  try {
    const query = `SELECT DISTINCT t.name FROM town t ORDER BY t.name`;
    const result = await client.query(query);
    return result.rows.map(r => r.name);
  } finally {
    client.release();
  }
}

async function logFailedQuery(userId, message, error, intentObj) {
  if (!mongoUri) return;
  let mongoClient;
  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    await db.collection('failed_queries').insertOne({
      user_id: userId,
      message,
      intent: intentObj?.intent || 'unknown',
      filters: intentObj?.filters || {},
      error_message: error.message,
      created_at: new Date(),
      status: 'pending_review'
    });
  } catch (mongoError) {
    console.error('⚠️ Failed to log error:', mongoError.message);
  } finally {
    if (mongoClient) await mongoClient.close();
  }
}

// NEW: Price Prediction Query
async function queryPricePrediction(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, prediction_year, limit } = filters || {};
    
    if (!town || !flat_type || !prediction_year) {
      return {
        type: 'price_prediction',
        error: 'Please specify town, flat type, and prediction year',
        prediction: null
      };
    }

    // Get town_id
    const townQuery = `SELECT town_id FROM town WHERE name = $1`;
    const townResult = await client.query(townQuery, [town.toUpperCase()]);
    
    if (townResult.rows.length === 0) {
      return {
        type: 'price_prediction',
        error: `Town "${town}" not found`,
        prediction: null
      };
    }

    const townId = townResult.rows[0].town_id;
    const rowLimit = limit || 12; // Default to 12 months if not specified

    const query = `
      SELECT 
        pp.prediction_id,
        t.name AS town,
        pp.flat_type,
        pp.prediction_year,
        pp.prediction_month,
        pp.predicted_price,
        pp.confidence_lower,
        pp.confidence_upper,
        pp.base_price,
        pp.yoy_growth_rate,
        pp.model_version,
        pp.created_at
      FROM price_prediction pp
      JOIN town t ON pp.town_id = t.town_id
      WHERE pp.town_id = $1 
        AND pp.flat_type = $2 
        AND pp.prediction_year = $3
      ORDER BY pp.prediction_month
      LIMIT $4
    `;

    console.log('🔮 Price prediction query');
    console.log(`📍 Town: ${town}, Flat: ${flat_type}, Year: ${prediction_year}, Limit: ${rowLimit}`);

    const result = await client.query(query, [townId, flat_type.toUpperCase(), prediction_year, rowLimit]);
    
    if (result.rows.length === 0) {
      // No prediction data - calculate simple projection
      const historicalQuery = `
        SELECT 
          ROUND(AVG(rt.resale_price)) as avg_price,
          EXTRACT(YEAR FROM rt.contract_date) as year
        FROM resale_transaction rt
        JOIN hdbflat hf ON rt.flat_id = hf.flat_id
        JOIN hdbblock hb ON hf.block_id = hb.block_id
        JOIN town t ON hb.town_id = t.town_id
        WHERE t.name = $1 AND hf.flat_type = $2
        GROUP BY year
        ORDER BY year DESC
        LIMIT 5
      `;
      
      const historicalResult = await client.query(historicalQuery, [town.toUpperCase(), flat_type.toUpperCase()]);
      
      if (historicalResult.rows.length === 0) {
        return {
          type: 'price_prediction',
          error: `No historical data found for ${flat_type} in ${town}`,
          prediction: null
        };
      }

      // Simple linear projection
      const recentData = historicalResult.rows;
      const avgGrowth = recentData.length > 1 
        ? (parseFloat(recentData[0].avg_price) - parseFloat(recentData[recentData.length - 1].avg_price)) / recentData.length
        : 0;
      
      const currentYear = new Date().getFullYear();
      const yearsAhead = prediction_year - currentYear;
      const basePrice = parseFloat(recentData[0].avg_price);
      const predictedPrice = basePrice + (avgGrowth * yearsAhead);

      return {
        type: 'price_prediction',
        prediction: {
          town: town.toUpperCase(),
          flat_type: flat_type.toUpperCase(),
          prediction_year,
          predicted_price: Math.round(predictedPrice),
          confidence_lower: Math.round(predictedPrice * 0.85),
          confidence_upper: Math.round(predictedPrice * 1.15),
          base_price: Math.round(basePrice),
          yoy_growth_rate: (avgGrowth / basePrice * 100).toFixed(2),
          model_version: 'simple_linear_projection',
          note: 'Estimated based on recent historical trends (no database prediction available)'
        },
        historical_data: recentData,
        filters_applied: filters
      };
    }

    console.log(`✅ Found ${result.rows.length} prediction records`);

    return {
      type: 'price_prediction',
      predictions: result.rows,
      count: result.rows.length,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

// Search flats with row limit
async function querySearchFlats(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, min_price, max_price, year, start_year, end_year, limit } = filters || {};
    const params = [];
    const whereParts = [];

    if (town) {
      params.push(town.toUpperCase());
      whereParts.push(`t.name = $${params.length}`);
    }
    
    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    
    if (min_price != null) {
      params.push(min_price);
      whereParts.push(`rt.resale_price >= $${params.length}`);
    }
    if (max_price != null) {
      params.push(max_price);
      whereParts.push(`rt.resale_price <= $${params.length}`);
    }
    
    if (year) {
      params.push(year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
    } else {
      if (start_year) {
        params.push(start_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
      }
      if (end_year) {
        params.push(end_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const rowLimit = limit || 20; // Default to 20 if not specified
    params.push(rowLimit);

    const query = `
      SELECT rt.transaction_id, rt.flat_id, rt.contract_date, rt.resale_price,
        hf.flat_type, hf.floor_area_sqm, hb.block_no AS block,
        hb.street_name, t.name AS town,
        EXTRACT(YEAR FROM rt.contract_date) AS year
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      ${whereClause}
      ORDER BY rt.contract_date DESC
      LIMIT $${params.length}
    `;

    const result = await client.query(query, params);
    console.log(`✅ Found ${result.rows.length} results (limit: ${rowLimit})`);

    if (result.rows.length === 0) {
      return {
        type: 'search_flats',
        count: 0,
        flats: [],
        filters_applied: filters
      };
    }
    
    return {
      type: 'search_flats',
      count: result.rows.length,
      flats: result.rows,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

// Apply row limit to other query functions
async function queryCheapestOptions(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, year, start_year, end_year, min_price, max_price, limit } = filters || {};
    const params = [];
    const whereParts = [];

    if (town) {
      params.push(town.toUpperCase());
      whereParts.push(`t.name = $${params.length}`);
    }
    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    
    if (year) {
      params.push(year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
    } else {
      if (start_year) {
        params.push(start_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
      }
      if (end_year) {
        params.push(end_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
      }
    }
    
    if (min_price != null) {
      params.push(min_price);
      whereParts.push(`rt.resale_price >= $${params.length}`);
    }
    if (max_price != null) {
      params.push(max_price);
      whereParts.push(`rt.resale_price <= $${params.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const rowLimit = limit || 10;
    params.push(rowLimit);

    const query = `
      SELECT rt.transaction_id, rt.flat_id, rt.contract_date, rt.resale_price,
        hf.flat_type, hf.floor_area_sqm, hb.block_no AS block,
        hb.street_name, t.name AS town,
        EXTRACT(YEAR FROM rt.contract_date) AS year
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      ${whereClause}
      ORDER BY rt.resale_price ASC
      LIMIT $${params.length}
    `;

    const result = await client.query(query, params);
    
    return {
      type: 'cheapest_options',
      count: result.rows.length,
      flats: result.rows,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

async function queryMostExpensive(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, year, start_year, end_year, min_price, max_price, limit } = filters || {};
    const params = [];
    const whereParts = [];

    if (town) {
      params.push(town.toUpperCase());
      whereParts.push(`t.name = $${params.length}`);
    }
    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    
    if (year) {
      params.push(year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
    } else {
      if (start_year) {
        params.push(start_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
      }
      if (end_year) {
        params.push(end_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
      }
    }
    
    if (min_price != null) {
      params.push(min_price);
      whereParts.push(`rt.resale_price >= $${params.length}`);
    }
    if (max_price != null) {
      params.push(max_price);
      whereParts.push(`rt.resale_price <= $${params.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const rowLimit = limit || 10;
    params.push(rowLimit);

    const query = `
      SELECT rt.transaction_id, rt.flat_id, rt.contract_date, rt.resale_price,
        hf.flat_type, hf.floor_area_sqm, hb.block_no AS block,
        hb.street_name, t.name AS town,
        EXTRACT(YEAR FROM rt.contract_date) AS year
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      ${whereClause}
      ORDER BY rt.resale_price DESC
      LIMIT $${params.length}
    `;

    const result = await client.query(query, params);
    
    return {
      type: 'most_expensive',
      count: result.rows.length,
      flats: result.rows,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

// Keep other functions same as your working version
async function queryTownStats(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, year, start_year, end_year } = filters || {};
    
    if (!town) {
      return {
        type: 'town_stats',
        error: 'Please specify a town'
      };
    }

    const params = [town.toUpperCase()];
    const whereParts = ['t.name = $1'];

    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    
    if (year) {
      params.push(year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
    } else {
      if (start_year) {
        params.push(start_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
      }
      if (end_year) {
        params.push(end_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
      }
    }

    const whereClause = whereParts.join(' AND ');

    const query = `
      SELECT 
        t.name AS town,
        COUNT(*) AS total_transactions,
        ROUND(AVG(rt.resale_price)) AS avg_price,
        MIN(rt.resale_price) AS min_price,
        MAX(rt.resale_price) AS max_price,
        MIN(EXTRACT(YEAR FROM rt.contract_date)) AS earliest_year,
        MAX(EXTRACT(YEAR FROM rt.contract_date)) AS latest_year
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE ${whereClause}
      GROUP BY t.name
    `;

    const result = await client.query(query, params);
    
    if (result.rows.length === 0) {
      return {
        type: 'town_stats',
        stats: null,
        error: `No data found for ${town}`
      };
    }

    return {
      type: 'town_stats',
      stats: result.rows[0],
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

async function queryPopularTowns(filters) {
  const client = await pool.connect();
  try {
    const { flat_type, year, start_year, end_year } = filters || {};
    const params = [];
    const whereParts = [];

    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    
    if (year) {
      params.push(year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
    } else {
      if (start_year) {
        params.push(start_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
      }
      if (end_year) {
        params.push(end_year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
      }
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const query = `
      SELECT t.name AS town, COUNT(*) AS transaction_count,
        ROUND(AVG(rt.resale_price)) AS avg_price,
        MIN(rt.resale_price) AS min_price,
        MAX(rt.resale_price) AS max_price
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      ${whereClause}
      GROUP BY t.name
      ORDER BY transaction_count DESC
      LIMIT 10
    `;

    const result = await client.query(query, params);
    return {
      type: 'popular_towns',
      towns: result.rows,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

async function queryPriceTrend(filters) {
  const client = await pool.connect();
  try {
    const { town, flat_type, start_year, end_year } = filters || {};
    const params = [];
    const whereParts = [];

    if (town) {
      params.push(town.toUpperCase());
      whereParts.push(`t.name = $${params.length}`);
    }
    if (flat_type) {
      params.push(flat_type.toUpperCase());
      whereParts.push(`hf.flat_type = $${params.length}`);
    }
    if (start_year) {
      params.push(start_year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
    }
    if (end_year) {
      params.push(end_year);
      whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const query = `
      SELECT EXTRACT(YEAR FROM rt.contract_date) AS year,
        ROUND(AVG(rt.resale_price)) AS avg_resale_price,
        COUNT(*) AS transactions,
        MIN(rt.resale_price) AS min_price,
        MAX(rt.resale_price) AS max_price
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      ${whereClause}
      GROUP BY year
      ORDER BY year
    `;

    const result = await client.query(query, params);
    return {
      type: 'price_trend',
      points: result.rows,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

async function queryCompareTowns(filters) {
  const client = await pool.connect();
  try {
    const { town, town2, flat_type, year, start_year, end_year } = filters || {};
    if (!town || !town2) {
      return { 
        type: 'compare_towns', 
        towns: [],
        error: 'Please specify two towns'
      };
    }

    const results = [];
    for (const tName of [town, town2]) {
      const params = [tName.toUpperCase()];
      const whereParts = [`t.name = $1`];

      if (flat_type) {
        params.push(flat_type.toUpperCase());
        whereParts.push(`hf.flat_type = $${params.length}`);
      }
      
      if (year) {
        params.push(year);
        whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length}`);
      } else {
        if (start_year) {
          params.push(start_year);
          whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) >= $${params.length}`);
        }
        if (end_year) {
          params.push(end_year);
          whereParts.push(`EXTRACT(YEAR FROM rt.contract_date) <= $${params.length}`);
        }
      }

      const whereClause = whereParts.join(' AND ');

      const query = `
        SELECT t.name AS town, ROUND(AVG(rt.resale_price)) AS avg_resale_price,
          COUNT(*) AS transactions,
          MIN(rt.resale_price) AS min_price,
          MAX(rt.resale_price) AS max_price
        FROM resale_transaction rt
        JOIN hdbflat hf ON rt.flat_id = hf.flat_id
        JOIN hdbblock hb ON hf.block_id = hb.block_id
        JOIN town t ON hb.town_id = t.town_id
        WHERE ${whereClause}
        GROUP BY t.name
      `;

      const result = await client.query(query, params);
      if (result.rows[0]) {
        results.push(result.rows[0]);
      }
    }

    if (results.length === 2) {
      const diff = parseFloat(results[0].avg_resale_price) - parseFloat(results[1].avg_resale_price);
      const diffPercent = (Math.abs(diff) / parseFloat(results[1].avg_resale_price) * 100).toFixed(2);
      
      return {
        type: 'compare_towns',
        towns: results,
        comparison: {
          price_difference: Math.abs(diff),
          percent_difference: diffPercent,
          cheaper_town: diff > 0 ? results[1].town : results[0].town
        },
        filters_applied: filters
      };
    }

    return {
      type: 'compare_towns',
      towns: results,
      filters_applied: filters
    };
  } finally {
    client.release();
  }
}

async function runHdbQuery(intentObj) {
  const { intent, filters } = intentObj;

  try {
    switch (intent) {
      case 'price_prediction':
        return await queryPricePrediction(filters);
      case 'search_flats':
        return await querySearchFlats(filters);
      case 'town_stats':
        return await queryTownStats(filters);
      case 'cheapest_options':
        return await queryCheapestOptions(filters);
      case 'most_expensive':
        return await queryMostExpensive(filters);
      case 'popular_towns':
        return await queryPopularTowns(filters);
      case 'price_trend':
        return await queryPriceTrend(filters);
      case 'compare_towns':
        return await queryCompareTowns(filters);
      case 'general':
        return { type: 'general', message: 'Help query' };
      default:
        return { type: intent, message: 'Unknown intent' };
    }
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
}

router.post('/', async (req, res) => {
  const { message } = req.body;
  const userId = req.body.userId || getUserIdFromRequest(req);

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }

  let mongoClient;
  let intentObj = null;

  try {
    console.log('📝 Message:', message);

    intentObj = await extractIntentAndFilters(message);
    console.log('🎯 Intent:', intentObj.intent);
    console.log('🔍 Filters:', JSON.stringify(intentObj.filters));

    const data = await runHdbQuery(intentObj);
    console.log(`📊 Results:`, data.count || data.predictions?.length || 'N/A');

    const answer = await generateAnswer(message, intentObj, data);

    if (mongoUri) {
      try {
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        const db = mongoClient.db(dbName);

        await db.collection('chat_logs').insertOne({
          user_id: userId,
          message,
          intent: intentObj.intent,
          filters: intentObj.filters,
          answer,
          data_type: data.type,
          data_count: data.count || 0,
          created_at: new Date(),
          success: true
        });
      } catch (mongoError) {
        console.error('MongoDB:', mongoError.message);
      }
    }

    res.json({
      success: true,
      answer,
      intent: intentObj.intent,
      filters: intentObj.filters,
      data: intentObj.intent === 'general' ? null : data,
      logged: true
    });

  } catch (err) {
    console.error('❌ Error:', err);
    await logFailedQuery(userId, message, err, intentObj);

    let errorMessage;
    try {
      const availableTowns = await getAvailableTowns();
      errorMessage = await generateSmartAlternatives(message, intentObj, availableTowns);
    } catch (altError) {
      errorMessage = "I'm sorry, I don't have data for that request.\n\nTry:\n• Show me 4-room flats in Tampines\n• Predict 4-room price in Bedok in 10 years\n• Compare Ang Mo Kio and Bedok\n\nI've logged your request!";
    }

    res.status(200).json({
      success: false,
      error: errorMessage,
      logged: true
    });
  } finally {
    if (mongoClient) await mongoClient.close();
  }
});

router.get('/test-connections', async (req, res) => {
  const results = { supabase: { connected: false }, mongodb: { connected: false } };

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    results.supabase.connected = true;
  } catch (error) {
    results.supabase.error = error.message;
  }

  let mongoClient;
  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    await mongoClient.db(dbName).admin().ping();
    results.mongodb.connected = true;
  } catch (error) {
    results.mongodb.error = error.message;
  } finally {
    if (mongoClient) await mongoClient.close();
  }

  res.json({
    success: results.supabase.connected && results.mongodb.connected,
    connections: results
  });
});

module.exports = router;