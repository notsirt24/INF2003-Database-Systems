// ============================================
// Dashboard API Routes - Updated with Extended Time Ranges
// File: routes/dashboardRoutes.js
// ============================================

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

// Helper function to get months back from range parameter
const getMonthsFromRange = (range) => {
  const rangeMap = {
    '3m': 3,
    '6m': 6,
    '1y': 12,
    '2y': 24,
    '3y': 36,
    '5y': 60,
    'all': null  // null means all available data
  };
  return rangeMap[range] !== undefined ? rangeMap[range] : 12; // default to 12 months
};

// ============================================
// GET /api/dashboard/towns
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
// ============================================
router.get('/price-trends', async (req, res) => {
  try {
    const { town = 'All', range = '1y', year } = req.query;

    let startDate, endDate;

    if (year && year !== 'All') {
      startDate = new Date(`${year}-01-01`);
      const yearEndDate = new Date(`${year}-12-31`);
      const today = new Date();
      endDate = yearEndDate > today ? today : yearEndDate;
    } else {
      const monthsBack = getMonthsFromRange(range);
      endDate = new Date();

      if (monthsBack === null) {
        // 'all' - get earliest date from database
        const minDateResult = await pool.query(`
          SELECT MIN(contract_date) as min_date 
          FROM resale_transaction
        `);
        startDate = minDateResult.rows[0].min_date
          ? new Date(minDateResult.rows[0].min_date)
          : new Date('2017-01-01');
      } else {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
      }
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
// ============================================
router.get('/town-comparison', async (req, res) => {
  try {
    const { year = 'All', range = '1y', towns } = req.query;

    const params = [];
    const conditions = [];

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

    if (year && year !== 'All') {
      conditions.push(`EXTRACT(YEAR FROM rt.contract_date) = $${params.length + 1}`);
      params.push(year);
    } else {
      const monthsBack = getMonthsFromRange(range);
      if (monthsBack !== null) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateStr = startDate.toISOString().split('T')[0];
        conditions.push(`rt.contract_date >= $${params.length + 1}`);
        params.push(startDateStr);
      }
      // If monthsBack is null ('all'), no date filter
    }

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

    data.sort((a, b) => b.avgPrice - a.avgPrice);

    if (!hasTownFilter && data.length > 10) {
      for (let i = data.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data[i], data[j]] = [data[j], data[i]];
      }
      data = data.slice(0, 10);
      data.sort((a, b) => b.avgPrice - a.avgPrice);
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching town comparison:', error);
    res.status(500).json({ error: 'Failed to fetch town comparison' });
  }
});

// ============================================
// GET /api/dashboard/flat-type-distribution
// ============================================
router.get('/flat-type-distribution', async (req, res) => {
  try {
    const { town = 'All', year = 'All', range = '1y' } = req.query;

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
    let hasWhere = false;

    if (year && year !== 'All') {
      query += ` WHERE EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
      hasWhere = true;
    } else {
      const monthsBack = getMonthsFromRange(range);
      if (monthsBack !== null) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateStr = startDate.toISOString().split('T')[0];
        query += ` WHERE rt.contract_date >= $${paramIndex}`;
        params.push(startDateStr);
        paramIndex++;
        hasWhere = true;
      }
    }

    if (town !== 'All') {
      query += hasWhere ? ` AND t.name = $${paramIndex}` : ` WHERE t.name = $${paramIndex}`;
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
// ============================================
router.get('/transaction-volume', async (req, res) => {
  try {
    const { range = '1y', year } = req.query;

    let startDate, endDate;

    if (year && year !== 'All') {
      startDate = new Date(`${year}-01-01`);
      const yearEndDate = new Date(`${year}-12-31`);
      const today = new Date();
      endDate = yearEndDate > today ? today : yearEndDate;
    } else {
      const monthsBack = getMonthsFromRange(range);
      endDate = new Date();

      if (monthsBack === null) {
        const minDateResult = await pool.query(`
          SELECT MIN(contract_date) as min_date 
          FROM resale_transaction
        `);
        startDate = minDateResult.rows[0].min_date
          ? new Date(minDateResult.rows[0].min_date)
          : new Date('2017-01-01');
      } else {
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
      }
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
// ============================================
router.get('/key-metrics', async (req, res) => {
  try {
    const { town = 'All', year, range = '1y' } = req.query;

    let currentStartDate, currentEndDate, previousStartDate, previousEndDate;

    if (year && year !== 'All') {
      const selectedYear = parseInt(year);

      currentStartDate = new Date(`${selectedYear}-01-01`);
      const yearEndDate = new Date(`${selectedYear}-12-31`);
      const today = new Date();
      currentEndDate = yearEndDate > today ? today : yearEndDate;

      previousStartDate = new Date(`${selectedYear - 1}-01-01`);
      previousEndDate = new Date(`${selectedYear - 1}-12-31`);
    } else {
      const monthsBack = getMonthsFromRange(range);

      if (monthsBack === null) {
        // For 'all' range, compare last year vs previous year
        currentStartDate = new Date();
        currentStartDate.setFullYear(currentStartDate.getFullYear() - 1);
        currentEndDate = new Date();

        previousStartDate = new Date();
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 2);
        previousEndDate = new Date();
        previousEndDate.setFullYear(previousEndDate.getFullYear() - 1);
      } else {
        currentStartDate = new Date();
        currentStartDate.setMonth(currentStartDate.getMonth() - monthsBack);
        currentEndDate = new Date();

        previousStartDate = new Date();
        previousStartDate.setMonth(previousStartDate.getMonth() - (monthsBack * 2));
        previousEndDate = new Date();
        previousEndDate.setMonth(previousEndDate.getMonth() - monthsBack);
      }
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
// ============================================
router.get('/top-blocks', async (req, res) => {
  try {
    const { town = 'All', year = 'All', range = '1y' } = req.query;

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
    let hasWhere = false;

    if (year && year !== 'All') {
      query += ` WHERE EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
      hasWhere = true;
    } else {
      const monthsBack = getMonthsFromRange(range);
      if (monthsBack !== null) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateStr = startDate.toISOString().split('T')[0];
        query += ` WHERE rt.contract_date >= $${paramIndex}`;
        params.push(startDateStr);
        paramIndex++;
        hasWhere = true;
      }
    }

    if (town !== 'All') {
      query += hasWhere ? ` AND t.name = $${paramIndex}` : ` WHERE t.name = $${paramIndex}`;
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
// ============================================
router.get('/lease-analysis', async (req, res) => {
  try {
    const { town = 'All', year = 'All', range = '1y' } = req.query;

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

    if (year && year !== 'All') {
      query += ` AND EXTRACT(YEAR FROM rt.contract_date) = $${paramIndex}`;
      params.push(year);
      paramIndex++;
    } else {
      const monthsBack = getMonthsFromRange(range);
      if (monthsBack !== null) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);
        const startDateStr = startDate.toISOString().split('T')[0];
        query += ` AND rt.contract_date >= $${paramIndex}`;
        params.push(startDateStr);
        paramIndex++;
      }
    }

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

// ============================================
// Price Prediction API Routes
// ============================================

// ============================================
// GET /api/dashboard/predict-price
// Generate price predictions based on historical trends
// ============================================
router.get('/predict-price', async (req, res) => {
  try {
    const { town = 'All', flatType = 'All', yearsAhead = 5 } = req.query;

    const years = parseInt(yearsAhead);
    if (years < 1 || years > 10) {
      return res.status(400).json({ error: 'Years ahead must be between 1 and 10' });
    }

    // Step 1: Get historical data for the last 3 years
    const historicalQuery = `
      SELECT 
        DATE_TRUNC('month', rt.contract_date) as month,
        AVG(rt.resale_price) as avg_price,
        COUNT(*) as transaction_count
      FROM resale_transaction rt
      JOIN hdbflat hf ON rt.flat_id = hf.flat_id
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
      WHERE rt.contract_date >= NOW() - INTERVAL '3 years'
      ${town !== 'All' ? 'AND t.name = $1' : ''}
      ${flatType !== 'All' ? (town !== 'All' ? 'AND hf.flat_type = $2' : 'AND hf.flat_type = $1') : ''}
      GROUP BY DATE_TRUNC('month', rt.contract_date)
      HAVING COUNT(*) >= 3
      ORDER BY month ASC
    `;

    const params = [];
    if (town !== 'All') params.push(town);
    if (flatType !== 'All') params.push(flatType);

    const historicalResult = await pool.query(historicalQuery, params);

    if (historicalResult.rows.length < 6) {
      return res.status(400).json({
        error: 'Insufficient historical data for prediction',
        message: 'Need at least 6 months of data'
      });
    }

    // Step 2: Calculate trend using linear regression
    const historicalData = historicalResult.rows.map((row, index) => ({
      x: index,
      y: parseFloat(row.avg_price),
      month: row.month
    }));

    // Simple linear regression
    const n = historicalData.length;
    const sumX = historicalData.reduce((sum, point) => sum + point.x, 0);
    const sumY = historicalData.reduce((sum, point) => sum + point.y, 0);
    const sumXY = historicalData.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumX2 = historicalData.reduce((sum, point) => sum + point.x * point.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate standard error for confidence intervals
    const predictions = historicalData.map(point => slope * point.x + intercept);
    const residuals = historicalData.map((point, i) => point.y - predictions[i]);
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const standardError = Math.sqrt(mse);

    // Step 3: Get the latest data point
    const latestMonth = new Date(historicalData[historicalData.length - 1].month);
    const currentPrice = historicalData[historicalData.length - 1].y;

    // Monthly growth rate
    const monthlyGrowthRate = slope / currentPrice;
    const annualGrowthRate = (Math.pow(1 + monthlyGrowthRate, 12) - 1) * 100;

    // Step 4: Generate predictions
    const predictions_data = [];
    const currentDate = new Date();

    // Add last 3 months of historical data for context
    for (let i = Math.max(0, historicalData.length - 3); i < historicalData.length; i++) {
      const month = new Date(historicalData[i].month);
      predictions_data.push({
        month: month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        price: Math.round(historicalData[i].y),
        isHistorical: true,
        lowerBound: null,
        upperBound: null
      });
    }

    // Generate future predictions
    for (let i = 1; i <= years * 12; i++) {
      const futureDate = new Date(latestMonth);
      futureDate.setMonth(futureDate.getMonth() + i);

      const x = historicalData.length - 1 + i;
      const predictedPrice = slope * x + intercept;

      // Confidence interval (95% = 1.96 * SE)
      const confidenceMargin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(x - sumX / n, 2) / sumX2);

      predictions_data.push({
        month: futureDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        price: Math.round(predictedPrice),
        isHistorical: false,
        lowerBound: Math.round(predictedPrice - confidenceMargin),
        upperBound: Math.round(predictedPrice + confidenceMargin)
      });
    }

    // Step 5: Store predictions in database (only future predictions)
    if (town !== 'All' || flatType !== 'All') {
      const townIdQuery = town !== 'All'
        ? await pool.query('SELECT town_id FROM town WHERE name = $1', [town])
        : null;

      const townId = townIdQuery && townIdQuery.rows.length > 0
        ? townIdQuery.rows[0].town_id
        : null;

      // Delete old predictions for this combination
      await pool.query(`
        DELETE FROM price_prediction 
        WHERE ${townId ? 'town_id = $1' : 'town_id IS NULL'}
        ${flatType !== 'All' ? (townId ? 'AND flat_type = $2' : 'AND flat_type = $1') : ''}
      `, townId ? (flatType !== 'All' ? [townId, flatType] : [townId]) : (flatType !== 'All' ? [flatType] : []));

      // Before the insert loop, construct the conflict target dynamically
      const conflictColumns = townId
        ? '(town_id, flat_type, prediction_year, prediction_month)'
        : '(flat_type, prediction_year, prediction_month) WHERE town_id IS NULL';

      // Insert new predictions
      for (let i = 1; i <= years * 12; i++) {
        const futureDate = new Date(latestMonth);
        futureDate.setMonth(futureDate.getMonth() + i);

        const x = historicalData.length - 1 + i;
        const predictedPrice = slope * x + intercept;
        const confidenceMargin = 1.96 * standardError * Math.sqrt(1 + 1 / n + Math.pow(x - sumX / n, 2) / sumX2);

        await pool.query(`
          INSERT INTO price_prediction (
            town_id, flat_type, prediction_year, prediction_month,
            predicted_price, confidence_lower, confidence_upper,
            base_price, yoy_growth_rate, model_version, features
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT ${conflictColumns}
          DO UPDATE SET
            predicted_price = EXCLUDED.predicted_price,
            confidence_lower = EXCLUDED.confidence_lower,
            confidence_upper = EXCLUDED.confidence_upper,
            base_price = EXCLUDED.base_price,
            yoy_growth_rate = EXCLUDED.yoy_growth_rate,
            created_at = CURRENT_TIMESTAMP
        `, [
          townId,
          flatType !== 'All' ? flatType : 'All',
          futureDate.getFullYear(),
          futureDate.getMonth() + 1,
          Math.round(predictedPrice),
          Math.round(predictedPrice - confidenceMargin),
          Math.round(predictedPrice + confidenceMargin),
          Math.round(currentPrice),
          annualGrowthRate.toFixed(2),
          'linear_trend_v1',
          JSON.stringify({
            historicalMonths: n,
            slope: slope.toFixed(2),
            intercept: intercept.toFixed(2)
          })
        ]);
      }
    }

    // Step 6: Return response
    res.json({
      predictions: predictions_data,
      metadata: {
        currentPrice: Math.round(currentPrice),
        projectedPrice: predictions_data[predictions_data.length - 1].price,
        annualGrowthRate: annualGrowthRate.toFixed(2),
        totalGrowth: ((predictions_data[predictions_data.length - 1].price - currentPrice) / currentPrice * 100).toFixed(2),
        historicalDataPoints: n,
        town: town,
        flatType: flatType,
        yearsAhead: years
      }
    });

  } catch (error) {
    console.error('Error generating price prediction:', error);
    res.status(500).json({ error: 'Failed to generate price prediction' });
  }
});

// ============================================
// GET /api/dashboard/flat-types
// Get available flat types for a town
// ============================================
router.get('/flat-types', async (req, res) => {
  try {
    const { town = 'All' } = req.query;

    let query = `
      SELECT DISTINCT hf.flat_type
      FROM hdbflat hf
      JOIN hdbblock hb ON hf.block_id = hb.block_id
      JOIN town t ON hb.town_id = t.town_id
    `;

    if (town !== 'All') {
      query += ` WHERE t.name = $1`;
    }

    query += ` ORDER BY hf.flat_type`;

    const result = await pool.query(
      query,
      town !== 'All' ? [town] : []
    );

    const flatTypes = result.rows.map(row => row.flat_type);
    res.json(flatTypes);
  } catch (error) {
    console.error('Error fetching flat types:', error);
    res.status(500).json({ error: 'Failed to fetch flat types' });
  }
});

module.exports = router;