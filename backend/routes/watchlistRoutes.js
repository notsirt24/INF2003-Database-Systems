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

// GET /api/watchlist - returns active watchlist rows for authenticated user
router.get('/watchlist', async (req, res) => {
  const token = getTokenFromHeader(req);
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this-in-production');
    const userId = decoded.user_id;

    const pool = getPool();
    try {
      const q = `
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
               t.name AS town,
               (
                 SELECT rt.resale_price
                 FROM resale_transaction rt
                 WHERE rt.flat_id = w.flat_id
                 ORDER BY rt.contract_date DESC, rt.transaction_id DESC
                 LIMIT 1
               ) AS resale_price
        FROM watchlist w
        LEFT JOIN hdbflat hf ON hf.flat_id = w.flat_id
        LEFT JOIN hdbblock hb ON hb.block_id = hf.block_id
        LEFT JOIN town t ON t.town_id = hb.town_id
        WHERE w.user_id = $1 AND w.is_active = true
        ORDER BY w.created_at DESC
      `;

      const { rows } = await pool.query(q, [userId]);
      // server-side dedupe: prefer the latest created_at for duplicated flat_ids
      const map = new Map();
      const duplicates = [];
      for (const r of rows) {
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
      const dedupedRows = Array.from(map.values());
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

      const listQ = `
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
               t.name AS town,
               (
                 SELECT rt.resale_price
                 FROM resale_transaction rt
                 WHERE rt.flat_id = w.flat_id
                 ORDER BY rt.contract_date DESC, rt.transaction_id DESC
                 LIMIT 1
               ) AS resale_price
        FROM watchlist w
        LEFT JOIN hdbflat hf ON hf.flat_id = w.flat_id
        LEFT JOIN hdbblock hb ON hb.block_id = hf.block_id
        LEFT JOIN town t ON t.town_id = hb.town_id
        WHERE w.user_id = $1 AND w.is_active = true
        ORDER BY w.created_at DESC
      `;
      const list = await pool.query(listQ, [userId]);
      // dedupe same as GET
      const rows = list.rows || [];
      const map = new Map();
      const duplicates = [];
      for (const r of rows) {
        const id = r.flat_id == null ? Symbol() : String(r.flat_id);
        if (!map.has(id)) map.set(id, r);
        else {
          const existing = map.get(id);
          const existingTs = new Date(existing.created_at).getTime() || 0;
          const newTs = new Date(r.created_at).getTime() || 0;
          if (newTs > existingTs) map.set(id, r);
          duplicates.push({ existing, duplicate: r });
        }
      }
      if (duplicates.length) console.warn('[watchlistRoutes:add] duplicates detected for user', userId, duplicates.length, duplicates.slice(0,5));
      const dedupedRows = Array.from(map.values());
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

      const listQ = `
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
               t.name AS town,
               (
                 SELECT rt.resale_price
                 FROM resale_transaction rt
                 WHERE rt.flat_id = w.flat_id
                 ORDER BY rt.contract_date DESC, rt.transaction_id DESC
                 LIMIT 1
               ) AS resale_price
        FROM watchlist w
        LEFT JOIN hdbflat hf ON hf.flat_id = w.flat_id
        LEFT JOIN hdbblock hb ON hb.block_id = hf.block_id
        LEFT JOIN town t ON t.town_id = hb.town_id
        WHERE w.user_id = $1 AND w.is_active = true
        ORDER BY w.created_at DESC
      `;
      const list = await pool.query(listQ, [userId]);
      // dedupe same as GET
      const rows = list.rows || [];
      const map = new Map();
      const duplicates = [];
      for (const r of rows) {
        const id = r.flat_id == null ? Symbol() : String(r.flat_id);
        if (!map.has(id)) map.set(id, r);
        else {
          const existing = map.get(id);
          const existingTs = new Date(existing.created_at).getTime() || 0;
          const newTs = new Date(r.created_at).getTime() || 0;
          if (newTs > existingTs) map.set(id, r);
          duplicates.push({ existing, duplicate: r });
        }
      }
      if (duplicates.length) console.warn('[watchlistRoutes:remove] duplicates detected for user', userId, duplicates.length, duplicates.slice(0,5));
      const dedupedRows = Array.from(map.values());
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
