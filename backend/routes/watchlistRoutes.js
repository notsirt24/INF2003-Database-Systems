const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

function getTokenFromHeader(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.split(' ')[1];
}

// Helper function to apply the same grouping logic as listings page
async function getEnhancedWatchlistData(userId, pool) {
  // First, get the basic watchlist items
  const watchlistQuery = `
    SELECT w.watchlist_id,
           w.user_id,
           w.flat_id,
           w.note,
           w.created_at,
           w.updated_at,
           w.removed_at,
           w.is_active,
           hf.flat_type,
           hf.floor_area_sqm,
           hf.remaining_lease_years AS remaining_lease_years_at_sale,
           hb.block_no AS block,
           hb.street_name,
           hb.postal_code,
           t.name AS town
    FROM watchlist w
    LEFT JOIN hdbflat hf ON hf.flat_id = w.flat_id
    LEFT JOIN hdbblock hb ON hb.block_id = hf.block_id
    LEFT JOIN town t ON t.town_id = hb.town_id
    WHERE w.user_id = $1 AND w.is_active = true
    ORDER BY w.created_at DESC
  `;

  const { rows: watchlistRows } = await pool.query(watchlistQuery, [userId]);

  if (watchlistRows.length === 0) {
    return [];
  }

  // Get ALL transactions from the database (same as listings page)
  const allTransactionsQuery = `
    SELECT
      rt.transaction_id,
      rt.flat_id,
      rt.contract_date,
      rt.resale_price,
      rt.price_psm,
      hf.flat_type,
      hf.floor_area_sqm,
      rt.remaining_lease_years_at_sale,
      hb.block_no as block,
      hb.street_name as street_name,
      hb.postal_code,
      t.name as town
    FROM resale_transaction rt
    JOIN hdbflat hf ON rt.flat_id = hf.flat_id
    JOIN hdbblock hb ON hf.block_id = hb.block_id
    JOIN town t ON hb.town_id = t.town_id
    ORDER BY rt.contract_date DESC
    LIMIT 1000
  `;

  const { rows: allTransactions } = await pool.query(allTransactionsQuery);

  // Apply the same grouping logic as listings page
  const groups = {};
  for (const l of allTransactions) {
    const blk = (l.block || 'Unknown').toString();
    const street = (l.street_name || '').toString();
    const townName = (l.town || '').toString();
    const flatType = (l.flat_type || '').toString();
    const key = `${blk}|||${street}|||${townName}|||${flatType}`;
    if (!groups[key]) groups[key] = { block: blk, street, townName, flatType, items: [] };
    groups[key].items.push(l);
  }

  const groupEntries = {};
  Object.keys(groups).forEach(k => {
    const g = groups[k];
    const prices = g.items.map(x => Number(x.resale_price) || 0).filter(v => v > 0);
    const min = prices.length ? Math.min(...prices) : null;
    const max = prices.length ? Math.max(...prices) : null;
    let rep = g.items[0];
    try {
      const sorted = g.items.slice().sort((a, b) => {
        const ta = a.contract_date ? new Date(a.contract_date).getTime() : 0;
        const tb = b.contract_date ? new Date(b.contract_date).getTime() : 0;
        return tb - ta;
      });
      if (sorted && sorted.length) rep = sorted[0];
    } catch (e) {}
    groupEntries[k] = { 
      representative: rep, 
      block_min_price: min, 
      block_max_price: max, 
      merged_count: g.items.length 
    };
  });

  // Enhance watchlist items with grouping data
  const enhancedRows = watchlistRows.map(row => {
    const blk = (row.block || 'Unknown').toString();
    const street = (row.street_name || '').toString();
    const townName = (row.town || '').toString();
    const flatType = (row.flat_type || '').toString();
    const key = `${blk}|||${street}|||${townName}|||${flatType}`;
    
    const groupData = groupEntries[key];
    if (groupData) {
      return {
        ...row,
        resale_price: groupData.representative.resale_price,
        block_min_price: groupData.block_min_price,
        block_max_price: groupData.block_max_price,
        merged_count: groupData.merged_count
      };
    }
    
    return {
      ...row,
      resale_price: null,
      block_min_price: null,
      block_max_price: null,
      merged_count: 1
    };
  });

  // server-side dedupe: prefer the latest created_at for duplicated flat_ids
  const map = new Map();
  const duplicates = [];
  for (const r of enhancedRows) {
    const id = r.flat_id == null ? Symbol() : String(r.flat_id);
    if (!map.has(id)) map.set(id, r);
    else {
      // pick the record with later created_at
      const existing = map.get(id);
      const existingTs = new Date(existing.created_at).getTime() || 0;
      const newTs = new Date(r.created_at).getTime() || 0;
      if (newTs > existingTs) map.set(id, r);
      duplicates.push({ existing, duplicate: r });
    }
  }
  if (duplicates.length) console.warn('[watchlistRoutes] duplicates detected for user', userId, duplicates.length, duplicates.slice(0,5));
  
  return Array.from(map.values());
}

// GET /api/watchlist - returns active watchlist rows for authenticated user
router.get('/watchlist', async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const pool = getPool();
    try {
      const dedupedRows = await getEnhancedWatchlistData(userId, pool);
      return res.json({ success: true, watchlist: { user_id: userId, properties: dedupedRows } });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Watchlist GET error:', error.message || error);
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// POST /api/watchlist/add - insert or reactivate a watchlist row
router.post('/watchlist/add', async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  const { flat_id, note } = req.body;
  if (!flat_id) return res.status(400).json({ success: false, message: 'flat_id is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const pool = getPool();
    try {
      // Upsert/watchlist insert (watchlist table per your schema doesn't have metadata)
      const upsertQuery = `
        INSERT INTO watchlist (user_id, flat_id, note, created_at, is_active)
        VALUES ($1, $2, $3, now(), true)
        ON CONFLICT (user_id, flat_id)
        DO UPDATE SET is_active = true, removed_at = NULL, note = EXCLUDED.note, updated_at = now()
        RETURNING *;
      `;

      const params = [userId, flat_id, note || null];
      await pool.query(upsertQuery, params);

      // Use the same grouping logic as GET endpoint
      const dedupedRows = await getEnhancedWatchlistData(userId, pool);
      return res.json({ success: true, watchlist: { user_id: userId, properties: dedupedRows } });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Watchlist ADD error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// POST /api/watchlist/remove - soft-delete
router.post('/watchlist/remove', async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  const { flat_id } = req.body;
  if (!flat_id) return res.status(400).json({ success: false, message: 'flat_id is required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const pool = getPool();
    try {
      const q = `
        UPDATE watchlist
        SET is_active = false, removed_at = now(), updated_at = now()
        WHERE user_id = $1 AND flat_id = $2
        RETURNING *;
      `;
      await pool.query(q, [userId, flat_id]);

      // Use the same grouping logic as GET endpoint
      const dedupedRows = await getEnhancedWatchlistData(userId, pool);
      return res.json({ success: true, watchlist: { user_id: userId, properties: dedupedRows } });
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error('Watchlist REMOVE error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

module.exports = router;
