// ============================================
// Dashboard API Routes
// File: routes/dashboardRoutes.js
// Uses DATABASE_URL from .env
// ============================================

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ============================================
// GET /api/dashboard/towns
// Fetch all available towns
// ============================================
router.get('/towns', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT name 
      FROM town 
      ORDER BY name
    `);
    
    const towns = result.rows.map(row => row.name);
    res.json(towns);
  } catch (error) {
    console.error('Error fetching towns:', error);
    res.status(500).json({ error: 'Failed to fetch towns' });
  }
});

// ============================================
// GET /api/dashboard/price-trends
// Fetch price trends over time
// ============================================
router.get('/price-trends', async (req, res) => {
  try {
    const { town = 'All', range = '12m', year } = req.query;
    
    let startDate, endDate;
    
    if (year && year !== 'All') {
      // If specific year is selected, show data for that year
      startDate = new Date(`${year}-01-01`);
      const yearEndDate = new Date(`${year}-12-31`);
      const today = new Date();
      
      // For current/future years, cap the end date to today
      endDate = yearEndDate > today ? today : yearEndDate;
    } else {
      // If "All" or no year, use the range from current date
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      endDate = new Date();
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    let query = `
      SELECT 
        DATE_TRUNC('month', rt.contract_date) as month,
        AVG(rt.resale_price) as avg_price,
        AVG(rt.price_psm) as avg_psm,
        COUNT(*) as transaction_count
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE rt.contract_date >= $1 AND rt.contract_date <= $2
    `;
    
    const params = [startDateStr, endDateStr];
    
    if (town !== 'All') {
      query += ` AND t.name = $3`;
      params.push(town);
    }
    
    query += `
      GROUP BY DATE_TRUNC('month', rt.contract_date)
      ORDER BY month ASC
    `;
    
    const result = await pool.query(query, params);
    
    const data = result.rows.map(row => ({
      month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      avgPrice: Math.round(parseFloat(row.avg_price)),
      avgPSM: Math.round(parseFloat(row.avg_psm))
    }));
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching price trends:', error);
    res.status(500).json({ error: 'Failed to fetch price trends' });
  }
});

// ============================================
// GET /api/dashboard/town-comparison
// Compare average prices across towns
// ============================================
router.get('/town-comparison', async (req, res) => {
  try {
    const { year = '2024', range = '12m', towns } = req.query;

    const params = [];
    const conditions = [];

    // Base query
    let query = `
      SELECT 
        t.name AS town,
        ROUND(AVG(rt.resale_price)) AS avg_price,
        COUNT(*) AS transaction_count
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
    `;

    // Date filtering
    if (year && year !== 'All') {
      conditions.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length + 1}`);
      params.push(year);
    } else {
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      conditions.push(`rt.contract_date >= $${params.length + 1}`);
      params.push(startDateStr);
    }

    // Town filter
    let hasTownFilter = false;
    if (towns && towns.trim().length > 0) {
      const townList = towns.split(',').map(t => t.trim());
      const placeholders = townList.map((_, i) => `$${params.length + i + 1}`).join(',');
      conditions.push(`t.name IN (${placeholders})`);
      params.push(...townList);
      hasTownFilter = true;
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += `
      GROUP BY t.name
    `;

    const result = await pool.query(query, params);
    let data = result.rows.map(row => ({
      town: row.town,
      avgPrice: parseInt(row.avg_price),
      count: parseInt(row.transaction_count)
    }));

    // Sort by price descending
    data.sort((a, b) => b.avgPrice - a.avgPrice);

    // If showing all towns (no filter), randomize and take 10
    if (!hasTownFilter) {
      if (data.length > 10) {
        // Fisher-Yates shuffle
        for (let i = data.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [data[i], data[j]] = [data[j], data[i]];
        }
        data = data.slice(0, 10);
        // Sort the random 10 by price
        data.sort((a, b) => b.avgPrice - a.avgPrice);
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching town comparison:', error);
    res.status(500).json({ error: 'Failed to fetch town comparison' });
  }
});

// ============================================
// GET /api/dashboard/flat-type-distribution
// Distribution of transactions by flat type
// ============================================
router.get('/flat-type-distribution', async (req, res) => {
  try {
    const { town = 'All', year = '2024', range = '12m' } = req.query;
    
    let query = `
      SELECT 
        hf.flat_type as name,
        COUNT(*) as count
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
    `;
    
    let params = [];
    let paramIndex = 1;
    
    // Date filter
    if (year && year !== 'All') {
      query += ` WHERE EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    } else {
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      query += ` WHERE rt.contract_date >= $${paramIndex}`;
      params.push(startDateStr);
      paramIndex++;
    }
    
    // Town filter
    if (town !== 'All') {
      query += ` AND t.name = $${paramIndex}`;
      params.push(town);
    }
    
    query += `
      GROUP BY hf.flat_type
      ORDER BY count DESC
    `;
    
    const result = await pool.query(query, params);
    
    const data = result.rows.map(row => ({
      name: row.name,
      count: parseInt(row.count)
    }));
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching flat type distribution:', error);
    res.status(500).json({ error: 'Failed to fetch flat type distribution' });
  }
});

// ============================================
// GET /api/dashboard/transaction-volume
// Monthly transaction volume
// ============================================
router.get('/transaction-volume', async (req, res) => {
  try {
    const { range = '12m', year } = req.query;
    
    let startDate, endDate;
    
    if (year && year !== 'All') {
      // If specific year is selected, show data for that year
      startDate = new Date(`${year}-01-01`);
      const yearEndDate = new Date(`${year}-12-31`);
      const today = new Date();
      
      // For current/future years, cap the end date to today
      endDate = yearEndDate > today ? today : yearEndDate;
    } else {
      // If "All" or no year, use the range from current date
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      endDate = new Date();
    }
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const query = `
      SELECT 
        DATE_TRUNC('month', contract_date) as month,
        COUNT(*) as count
      FROM resale_transaction
      WHERE contract_date >= $1 AND contract_date <= $2
      GROUP BY DATE_TRUNC('month', contract_date)
      ORDER BY month ASC
    `;
    
    const result = await pool.query(query, [startDateStr, endDateStr]);
    
    const data = result.rows.map(row => ({
      month: new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      count: parseInt(row.count)
    }));
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching transaction volume:', error);
    res.status(500).json({ error: 'Failed to fetch transaction volume' });
  }
});

// ============================================
// GET /api/dashboard/key-metrics
// Calculate key performance metrics
// ============================================
router.get('/key-metrics', async (req, res) => {
  try {
    const { town = 'All', year, range = '12m' } = req.query;
    
    let currentStartDate, currentEndDate, previousStartDate, previousEndDate;
    
    if (year && year !== 'All') {
      // If specific year is selected, compare that year vs previous year
      const selectedYear = parseInt(year);
      
      // Current period: selected year (up to today if current year)
      currentStartDate = new Date(`${selectedYear}-01-01`);
      const yearEndDate = new Date(`${selectedYear}-12-31`);
      const today = new Date();
      currentEndDate = yearEndDate > today ? today : yearEndDate;
      
      // Previous period: year before selected year
      previousStartDate = new Date(`${selectedYear - 1}-01-01`);
      previousEndDate = new Date(`${selectedYear - 1}-12-31`);
    } else {
      // Use range parameter when "All" is selected
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      
      // Current period: last X months
      currentStartDate = new Date();
      currentStartDate.setMonth(currentStartDate.getMonth() - monthsBack);
      currentEndDate = new Date();
      
      // Previous period: X months before that
      previousStartDate = new Date();
      previousStartDate.setMonth(previousStartDate.getMonth() - (monthsBack * 2));
      previousEndDate = new Date();
      previousEndDate.setMonth(previousEndDate.getMonth() - monthsBack);
    }
    
    const currentStartStr = currentStartDate.toISOString().split('T')[0];
    const currentEndStr = currentEndDate.toISOString().split('T')[0];
    const previousStartStr = previousStartDate.toISOString().split('T')[0];
    const previousEndStr = previousEndDate.toISOString().split('T')[0];
    
    let currentQuery = `
      SELECT 
        AVG(rt.resale_price) as avg_price,
        AVG(rt.price_psm) as avg_psm,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rt.resale_price) as median_price,
        COUNT(*) as total_transactions
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE rt.contract_date >= $1 AND rt.contract_date <= $2
    `;
    
    let previousQuery = `
      SELECT 
        AVG(rt.resale_price) as avg_price,
        AVG(rt.price_psm) as avg_psm,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rt.resale_price) as median_price,
        COUNT(*) as total_transactions
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE rt.contract_date >= $1 AND rt.contract_date <= $2
    `;
    
    const currentParams = [currentStartStr, currentEndStr];
    const previousParams = [previousStartStr, previousEndStr];
    
    if (town !== 'All') {
      currentQuery += ` AND t.name = $3`;
      previousQuery += ` AND t.name = $3`;
      currentParams.push(town);
      previousParams.push(town);
    }
    
    const [currentResult, previousResult] = await Promise.all([
      pool.query(currentQuery, currentParams),
      pool.query(previousQuery, previousParams)
    ]);
    
    const current = currentResult.rows[0];
    const previous = previousResult.rows[0];
    
    const calculateChange = (curr, prev) => {
      if (!prev || prev === 0) return 0;
      return ((curr - prev) / prev) * 100;
    };
    
    const metrics = {
      avgPrice: Math.round(parseFloat(current.avg_price || 0)),
      priceChange: calculateChange(
        parseFloat(current.avg_price || 0),
        parseFloat(previous.avg_price || 0)
      ),
      totalTransactions: parseInt(current.total_transactions || 0),
      volumeChange: calculateChange(
        parseInt(current.total_transactions || 0),
        parseInt(previous.total_transactions || 0)
      ),
      avgPSM: Math.round(parseFloat(current.avg_psm || 0)),
      psmChange: calculateChange(
        parseFloat(current.avg_psm || 0),
        parseFloat(previous.avg_psm || 0)
      ),
      medianPrice: Math.round(parseFloat(current.median_price || 0)),
      medianChange: calculateChange(
        parseFloat(current.median_price || 0),
        parseFloat(previous.median_price || 0)
      )
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching key metrics:', error);
    res.status(500).json({ error: 'Failed to fetch key metrics' });
  }
});

// ============================================
// GET /api/dashboard/top-blocks
// Top performing blocks by average price
// ============================================
router.get('/top-blocks', async (req, res) => {
  try {
    const { town = 'All', year = '2024', range = '12m' } = req.query;
    
    let query = `
      SELECT 
        hb.block_no as block,
        hb.street_name as street,
        t.name as town,
        AVG(rt.resale_price) as avg_price,
        COUNT(*) as transactions
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
    `;
    
    let params = [];
    let paramIndex = 1;
    
    // Date filter
    if (year && year !== 'All') {
      query += ` WHERE EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    } else {
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      query += ` WHERE rt.contract_date >= $${paramIndex}`;
      params.push(startDateStr);
      paramIndex++;
    }
    
    // Town filter
    if (town !== 'All') {
      query += ` AND t.name = $${paramIndex}`;
      params.push(town);
    }
    
    query += `
      GROUP BY hb.block_no, hb.street_name, t.name
      HAVING COUNT(*) >= 3
      ORDER BY avg_price DESC
      LIMIT 20
    `;
    
    const result = await pool.query(query, params);
    
    const data = result.rows.map(row => ({
      block: row.block,
      street: row.street,
      town: row.town,
      avgPrice: Math.round(parseFloat(row.avg_price)),
      transactions: parseInt(row.transactions)
    }));
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching top blocks:', error);
    res.status(500).json({ error: 'Failed to fetch top blocks' });
  }
});

// ============================================
// GET /api/dashboard/lease-analysis
// Price analysis by remaining lease years
// ============================================
router.get('/lease-analysis', async (req, res) => {
  try {
    const { town = 'All', year = '2024', range = '12m' } = req.query;

    let query = `
      SELECT 
        CASE 
          WHEN rt.remaining_lease_years_at_sale >= 90 THEN '90+ years'
          WHEN rt.remaining_lease_years_at_sale >= 80 THEN '80-89 years'
          WHEN rt.remaining_lease_years_at_sale >= 70 THEN '70-79 years'
          WHEN rt.remaining_lease_years_at_sale >= 60 THEN '60-69 years'
          ELSE 'Under 60 years'
        END AS lease_range,
        AVG(rt.resale_price) AS avg_price,
        COUNT(*) AS count
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE rt.remaining_lease_years_at_sale IS NOT NULL
    `;

    let params = [];
    let paramIndex = 1;

    // Date filter
    if (year && year !== 'All') {
      query += ` AND EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    } else {
      const monthsBack = range === '6m' ? 6 : range === '12m' ? 12 : 24;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);
      const startDateStr = startDate.toISOString().split('T')[0];
      query += ` AND rt.contract_date >= $${paramIndex}`;
      params.push(startDateStr);
      paramIndex++;
    }

    // Town filter
    if (town !== 'All') {
      query += ` AND t.name = $${paramIndex}`;
      params.push(town);
    }

    query += `
      GROUP BY 
        CASE 
          WHEN rt.remaining_lease_years_at_sale >= 90 THEN '90+ years'
          WHEN rt.remaining_lease_years_at_sale >= 80 THEN '80-89 years'
          WHEN rt.remaining_lease_years_at_sale >= 70 THEN '70-79 years'
          WHEN rt.remaining_lease_years_at_sale >= 60 THEN '60-69 years'
          ELSE 'Under 60 years'
        END
      ORDER BY 
        CASE 
          WHEN MIN(rt.remaining_lease_years_at_sale) >= 90 THEN 1
          WHEN MIN(rt.remaining_lease_years_at_sale) >= 80 THEN 2
          WHEN MIN(rt.remaining_lease_years_at_sale) >= 70 THEN 3
          WHEN MIN(rt.remaining_lease_years_at_sale) >= 60 THEN 4
          ELSE 5
        END;
    `;

    const result = await pool.query(query, params);

    const data = result.rows.map(row => ({
      range: row.lease_range,
      avgPrice: Math.round(parseFloat(row.avg_price)),
      count: parseInt(row.count),
    }));

    res.json(data);
  } catch (error) {
    console.error('Error fetching lease analysis:', error);
    res.status(500).json({ error: 'Failed to fetch lease analysis' });
  }
});


module.exports = router;