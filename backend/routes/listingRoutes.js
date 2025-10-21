const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// GET /api/listings?limit=50&town=...
router.get('/', async (req, res) => {
  try {
    const { limit = 50, town } = req.query;
    let params = [];
    let where = '';

    if (town) {
      params.push(town);
      where = `WHERE t.name = $${params.length}`;
    }

    const query = `
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
      ${where}
      ORDER BY rt.contract_date DESC
      LIMIT $${params.length + 1}
    `;

    params.push(parseInt(limit, 10));

    const result = await pool.query(query, params);
    const rows = result.rows.map(r => ({
      transaction_id: r.transaction_id,
      flat_id: r.flat_id,
      contract_date: r.contract_date,
      resale_price: parseInt(r.resale_price),
      price_psm: r.price_psm ? parseFloat(r.price_psm) : null,
      flat_type: r.flat_type,
      floor_area_sqm: r.floor_area_sqm ? parseFloat(r.floor_area_sqm) : null,
      remaining_lease_years_at_sale: r.remaining_lease_years_at_sale ? parseFloat(r.remaining_lease_years_at_sale) : null,
      block: r.block,
      street_name: r.street_name,
      postal_code: r.postal_code,
      town: r.town
    }));

    res.json({ success: true, listings: rows });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
