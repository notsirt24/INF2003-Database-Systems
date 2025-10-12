// ============================================
// Import and Normalize CSV Data to PostgreSQL
// File: database/scripts/import-normalized-data.js
// Matches normalized schema design
// ============================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'hdb_analytics',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function cleanString(value) {
  if (!value || value === 'na' || value === 'NA' || value === 'null') return null;
  return String(value).trim();
}

function cleanNumber(value) {
  if (!value || value === 'na' || value === 'NA' || value === 'null') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseRemainingLease(leaseStr) {
  if (!leaseStr) return null;
  const match = leaseStr.match(/(\d+)\s*years?/i);
  return match ? parseInt(match[1]) : null;
}

function parseMonthToDate(monthStr) {
  if (!monthStr) return null;
  const [year, month] = monthStr.split('-');
  return `${year}-${month}-01`;
}

// ============================================
// 1. IMPORT AMENITIES
// ============================================

async function importAmenities() {
  console.log('\n🗺️  Importing Amenities...');
  const client = await pool.connect();
  
  try {
    let totalImported = 0;

    // Import MRT Stations
    console.log('   📍 Importing MRT Stations...');
    const mrtPath = path.join(__dirname, '../../data/raw/MRT Stations.csv');
    if (fs.existsSync(mrtPath)) {
      const mrtData = await readCSV(mrtPath);
      let mrtCount = 0;
      
      for (const row of mrtData) {
        const lat = cleanNumber(row.Latitude);
        const lon = cleanNumber(row.Longitude);
        
        if (!lat || !lon) continue;
        
        await client.query(`
          INSERT INTO amenity (amenity_type, name, code, geom)
          VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
        `, [
          'MRT',
          cleanString(row.STN_NAME),
          cleanString(row.STN_NO),
          lon,
          lat
        ]);
        mrtCount++;
      }
      console.log(`      ✅ Imported ${mrtCount} MRT stations`);
      totalImported += mrtCount;
    }

    // Import Schools
    console.log('   🏫 Importing Schools...');
    const schoolPath = path.join(__dirname, '../../data/raw/Generalinformationofschools.csv');
    if (fs.existsSync(schoolPath)) {
      const schoolData = await readCSV(schoolPath);
      let schoolCount = 0;
      
      for (const row of schoolData) {
        await client.query(`
          INSERT INTO amenity (amenity_type, name, code, meta)
          VALUES ($1, $2, $3, $4)
        `, [
          'SCHOOL',
          cleanString(row.school_name),
          cleanString(row.postal_code),
          JSON.stringify({
            address: cleanString(row.address),
            principal: cleanString(row.principal_name),
            type: cleanString(row.type_code),
            level: cleanString(row.mainlevel_code)
          })
        ]);
        schoolCount++;
      }
      console.log(`      ✅ Imported ${schoolCount} schools`);
      totalImported += schoolCount;
    }

    // Import EV Chargers
    console.log('   ⚡ Importing EV Chargers...');
    const evPath = path.join(__dirname, '../../data/raw/Electric_Vehicle_Charging_Points.csv');
    if (fs.existsSync(evPath)) {
      const evData = await readCSV(evPath);
      let evCount = 0;
      
      for (const row of evData) {
        const lat = cleanNumber(row.Latitude);
        const lon = cleanNumber(row.Longitude);
        
        if (!lat || !lon) continue;
        
        await client.query(`
          INSERT INTO amenity (amenity_type, name, operator, code, geom, meta)
          VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7)
        `, [
          'EV_CHARGER',
          cleanString(row.Name),
          cleanString(row['Building Name']),
          cleanString(row['EV Charger Registration Code']),
          lon,
          lat,
          JSON.stringify({
            outlets: cleanNumber(row['No. of Charging Outlets']),
            connector_type: cleanString(row['Type of Connector']),
            power_kw: cleanNumber(row['Rated Output Power (kW)']),
            public: cleanString(row['Is the charger publicly accessible?'])
          })
        ]);
        evCount++;
        
        if (evCount % 1000 === 0) {
          console.log(`      Processing: ${evCount} / ${evData.length}`);
        }
      }
      console.log(`      ✅ Imported ${evCount} EV chargers`);
      totalImported += evCount;
    }

    console.log(`   ✅ Total amenities imported: ${totalImported}`);
    
  } catch (error) {
    console.error('   ❌ Error importing amenities:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 2. IMPORT AND NORMALIZE RESALE DATA
// ============================================

async function importResaleTransactions() {
  console.log('\n🏠 Importing and Normalizing Resale Transactions...');
  console.log('   ⏳ This will take several minutes...');
  
  const client = await pool.connect();
  
  try {
    const dataPath = path.join(__dirname, '../../data/raw/ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv');
    
    if (!fs.existsSync(dataPath)) {
      console.log('   ⚠️  File not found:', dataPath);
      return;
    }
    
    console.log('   📖 Reading CSV...');
    const data = await readCSV(dataPath);
    console.log(`   Found ${data.length} transactions`);
    
    // Load existing towns lookup
    console.log('   📊 Loading lookup tables...');
    const townLookup = {};
    const townResult = await client.query('SELECT town_id, name FROM town');
    townResult.rows.forEach(row => {
      townLookup[row.name.toUpperCase()] = row.town_id;
    });
    
    // Caches for normalization
    const blockCache = new Map(); // key: "block|street|town_id" -> block_id
    const flatCache = new Map();  // key: "block_id|flat_type|floor_area|storey|model" -> flat_id
    
    let imported = 0;
    let blockCount = 0;
    let flatCount = 0;
    
    await client.query('BEGIN');
    
    for (const row of data) {
      try {
        const townName = cleanString(row.town);
        const townId = townLookup[townName?.toUpperCase()];
        
        if (!townId) {
          console.log(`   ⚠️  Unknown town: ${townName}`);
          continue;
        }
        
        const blockNo = cleanString(row.block);
        const streetName = cleanString(row.street_name);
        const blockKey = `${blockNo}|${streetName}|${townId}`;
        
        // Get or create HDBBLOCK
        let blockId = blockCache.get(blockKey);
        
        if (!blockId) {
          const leaseCommenceYear = cleanNumber(row.lease_commence_date);
          const completionYear = leaseCommenceYear; // Same as lease commencement
          
          // Calculate max floor level from storey_range (e.g., "10 TO 12" → 12)
          let maxFloorLevel = null;
          const storeyRange = cleanString(row.storey_range);
          if (storeyRange) {
            const match = storeyRange.match(/(\d+)\s*TO\s*(\d+)/i);
            if (match) {
              maxFloorLevel = parseInt(match[2]);
            }
          }
          
          const blockResult = await client.query(`
            INSERT INTO hdbblock (
              town_id, block_no, street_name, 
              lease_commence_year, completion_year, max_floor_level
            ) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (block_no, street_name, town_id) 
            DO UPDATE SET 
              completion_year = COALESCE(hdbblock.completion_year, EXCLUDED.completion_year),
              max_floor_level = GREATEST(COALESCE(hdbblock.max_floor_level, 0), COALESCE(EXCLUDED.max_floor_level, 0))
            RETURNING block_id
          `, [townId, blockNo, streetName, leaseCommenceYear, completionYear, maxFloorLevel]);
          
          blockId = blockResult.rows[0].block_id;
          blockCache.set(blockKey, blockId);
          blockCount++;
        }
        
        // Get or create HDBFLAT
        const flatType = cleanString(row.flat_type);
        const floorArea = cleanNumber(row.floor_area_sqm);
        const storeyRange = cleanString(row.storey_range);
        const flatModel = cleanString(row.flat_model);
        const remainingLeaseYears = parseRemainingLease(cleanString(row.remaining_lease));
        
        const flatKey = `${blockId}|${flatType}|${floorArea}|${storeyRange}|${flatModel}`;
        let flatId = flatCache.get(flatKey);
        
        if (!flatId) {
          const flatResult = await client.query(`
            INSERT INTO hdbflat (
              block_id, flat_type, floor_area_sqm, 
              storey_range, model, remaining_lease_years
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING flat_id
          `, [blockId, flatType, floorArea, storeyRange, flatModel, remainingLeaseYears]);
          
          flatId = flatResult.rows[0].flat_id;
          flatCache.set(flatKey, flatId);
          flatCount++;
        }
        
        // Insert RESALE_TRANSACTION
        const contractDate = parseMonthToDate(cleanString(row.month));
        const resalePrice = cleanNumber(row.resale_price);
        const pricePSM = floorArea ? (resalePrice / floorArea) : null;
        
        await client.query(`
          INSERT INTO resale_transaction (
            flat_id, contract_date, resale_price, 
            price_psm, remaining_lease_years_at_sale
          ) VALUES ($1, $2, $3, $4, $5)
        `, [flatId, contractDate, resalePrice, pricePSM, remainingLeaseYears]);
        
        imported++;
        
        // Progress indicator
        if (imported % 10000 === 0) {
          const pct = ((imported / data.length) * 100).toFixed(1);
          console.log(`   Progress: ${imported}/${data.length} (${pct}%) | Blocks: ${blockCount} | Flats: ${flatCount}`);
        }
        
      } catch (rowError) {
        console.error(`   ⚠️  Error processing row ${imported}:`, rowError.message);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n   ✅ Import Complete!`);
    console.log(`      Transactions: ${imported}`);
    console.log(`      Unique Blocks: ${blockCount}`);
    console.log(`      Unique Flats: ${flatCount}`);
    
    // Post-processing: Calculate total_dwelling_units per block
    console.log('\n   🔄 Post-processing: Calculating total dwelling units...');
    await client.query(`
      UPDATE hdbblock
      SET total_dwelling_units = subquery.flat_count
      FROM (
        SELECT block_id, COUNT(*) as flat_count
        FROM hdbflat
        GROUP BY block_id
      ) AS subquery
      WHERE hdbblock.block_id = subquery.block_id
    `);
    
    const dwellingResult = await client.query('SELECT SUM(total_dwelling_units) as total FROM hdbblock');
    console.log(`      ✅ Updated dwelling units for blocks (Total: ${dwellingResult.rows[0].total})`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 3. CALCULATE PROXIMITIES (Optional - computationally intensive)
// ============================================

async function calculateProximities() {
  console.log('\n📏 Calculating Flat-Amenity Proximities...');
  console.log('   ⚠️  This is computationally intensive and may take 30+ minutes');
  console.log('   💡 You can skip this and run it separately later');
  
  // TODO: Implement proximity calculations using PostGIS distance functions
  // This would calculate distances from each flat to nearby amenities
  console.log('   ⏭️  Skipping for now - run separately for production');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('========================================');
  console.log('🚀 HDB Smart Analytics - Normalized Import');
  console.log('========================================');
  
  const startTime = Date.now();
  
  try {
    // Test database connection
    const testClient = await pool.connect();
    console.log('✅ Database connected');
    testClient.release();
    
    // Import in order
    await importAmenities();           // ~10K records, ~30 seconds
    await importResaleTransactions();  // ~217K records, ~5-10 minutes
    // await calculateProximities();   // Optional, very slow
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n========================================');
    console.log('✅ Import Complete!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log('========================================');
    
    // Print summary
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM town) as town_count,
        (SELECT COUNT(*) FROM hdbblock) as block_count,
        (SELECT COUNT(*) FROM hdbflat) as flat_count,
        (SELECT COUNT(*) FROM resale_transaction) as transaction_count,
        (SELECT COUNT(*) FROM amenity) as amenity_count
    `);
    
    console.log('\n📊 Database Summary:');
    console.log(`   Towns: ${stats.rows[0].town_count}`);
    console.log(`   HDB Blocks: ${stats.rows[0].block_count}`);
    console.log(`   HDB Flats: ${stats.rows[0].flat_count}`);
    console.log(`   Transactions: ${stats.rows[0].transaction_count}`);
    console.log(`   Amenities: ${stats.rows[0].amenity_count}`);
    console.log('\n🎉 Ready to use!');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the import
main();