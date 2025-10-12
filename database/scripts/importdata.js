// ============================================
// Import CSV Data to PostgreSQL (UPDATED)
// File: database/scripts/importData.js
// Matches your exact CSV column headers
// ============================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const csv = require('csv-parser');
require('dotenv').config();

// Database connection configuration
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

// Helper function to read CSV
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

// Helper function to clean string values
function cleanString(value) {
  if (!value || value === 'na' || value === 'NA' || value === 'null') return null;
  return String(value).trim();
}

// Helper function to clean number values
function cleanNumber(value) {
  if (!value || value === 'na' || value === 'NA' || value === 'null') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// ============================================
// 1. Import MRT Stations
// ============================================
async function importMRTStations() {
  console.log('\n📍 Importing MRT Stations...');
  const client = await pool.connect();
  
  try {
    const dataPath = path.join(__dirname, '../../data/raw/MRT Stations.csv');
    
    if (!fs.existsSync(dataPath)) {
      console.log('   ⚠️  File not found:', dataPath);
      return;
    }
    
    const data = await readCSV(dataPath);
    console.log(`   Found ${data.length} MRT stations`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of data) {
      const lat = cleanNumber(row.Latitude);
      const lon = cleanNumber(row.Longitude);
      
      if (!lat || !lon) {
        skipped++;
        continue;
      }
      
      await client.query(`
        INSERT INTO mrt_station (
          objectid, stn_name, stn_no, geometry,
          latitude, longitude, geom
        ) VALUES ($1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326))
      `, [
        cleanNumber(row.OBJECTID),
        cleanString(row.STN_NAME),
        cleanString(row.STN_NO),
        cleanString(row.geometry),
        lat,
        lon,
        lon, // PostGIS uses (lon, lat) order
        lat
      ]);
      
      imported++;
    }
    
    console.log(`   ✅ Successfully imported ${imported} MRT stations`);
    if (skipped > 0) console.log(`   ⚠️  Skipped ${skipped} records (missing coordinates)`);
    
  } catch (error) {
    console.error('   ❌ Error importing MRT stations:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 2. Import Schools
// ============================================
async function importSchools() {
  console.log('\n🏫 Importing Schools...');
  const client = await pool.connect();
  
  try {
    const dataPath = path.join(__dirname, '../../data/raw/Generalinformationofschools.csv');
    
    if (!fs.existsSync(dataPath)) {
      console.log('   ⚠️  File not found:', dataPath);
      return;
    }
    
    const data = await readCSV(dataPath);
    console.log(`   Found ${data.length} schools`);
    
    let imported = 0;
    
    for (const row of data) {
      await client.query(`
        INSERT INTO school (
          school_name, url_address, address, postal_code,
          telephone_no, telephone_no_2, fax_no, fax_no_2,
          email_address, mrt_desc, bus_desc,
          principal_name, first_vp_name, second_vp_name,
          third_vp_name, fourth_vp_name, fifth_vp_name, sixth_vp_name,
          dgp_code, zone_code, type_code, nature_code,
          session_code, mainlevel_code,
          sap_ind, autonomous_ind, gifted_ind, ip_ind,
          mothertongue1_code, mothertongue2_code, mothertongue3_code
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31
        )
      `, [
        cleanString(row.school_name),
        cleanString(row.url_address),
        cleanString(row.address),
        cleanString(row.postal_code),
        cleanString(row.telephone_no),
        cleanString(row.telephone_no_2),
        cleanString(row.fax_no),
        cleanString(row.fax_no_2),
        cleanString(row.email_address),
        cleanString(row.mrt_desc),
        cleanString(row.bus_desc),
        cleanString(row.principal_name),
        cleanString(row.first_vp_name),
        cleanString(row.second_vp_name),
        cleanString(row.third_vp_name),
        cleanString(row.fourth_vp_name),
        cleanString(row.fifth_vp_name),
        cleanString(row.sixth_vp_name),
        cleanString(row.dgp_code),
        cleanString(row.zone_code),
        cleanString(row.type_code),
        cleanString(row.nature_code),
        cleanString(row.session_code),
        cleanString(row.mainlevel_code),
        cleanString(row.sap_ind),
        cleanString(row.autonomous_ind),
        cleanString(row.gifted_ind),
        cleanString(row.ip_ind),
        cleanString(row.mothertongue1_code),
        cleanString(row.mothertongue2_code),
        cleanString(row.mothertongue3_code)
      ]);
      
      imported++;
    }
    
    console.log(`   ✅ Successfully imported ${imported} schools`);
    console.log(`   ℹ️  Note: Latitude/Longitude for schools will need geocoding`);
    
  } catch (error) {
    console.error('   ❌ Error importing schools:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 3. Import EV Chargers
// ============================================
async function importEVChargers() {
  console.log('\n⚡ Importing EV Charging Points...');
  const client = await pool.connect();
  
  try {
    const dataPath = path.join(__dirname, '../../data/raw/Electric_Vehicle_Charging_Points.csv');
    
    if (!fs.existsSync(dataPath)) {
      console.log('   ⚠️  File not found:', dataPath);
      return;
    }
    
    const data = await readCSV(dataPath);
    console.log(`   Found ${data.length} EV charging points`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of data) {
      const lat = cleanNumber(row.Latitude);
      const lon = cleanNumber(row.Longitude);
      
      if (!lat || !lon) {
        skipped++;
        continue;
      }
      
      await client.query(`
        INSERT INTO ev_charger (
          ev_charger_registration_code, name, no_of_charging_outlets,
          connector_id, type_of_connector, rated_output_power_kw,
          postal_code, block_house_no, street_name,
          building_name, floor_no, lot_no,
          is_charger_publicly_accessible, latitude, longitude, geom
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          ST_SetSRID(ST_MakePoint($16, $17), 4326)
        )
      `, [
        cleanString(row['EV Charger Registration Code']),
        cleanString(row.Name),
        cleanNumber(row['No. of Charging Outlets']),
        cleanString(row['Connector ID']),
        cleanString(row['Type of Connector']),
        cleanNumber(row['Rated Output Power (kW)']),
        cleanString(row['Postal Code']),
        cleanString(row['Block/House No']),
        cleanString(row['Street Name']),
        cleanString(row['Building Name']),
        cleanString(row['Floor No']),
        cleanString(row['Lot No']),
        cleanString(row['Is the charger publicly accessible?']),
        lat,
        lon,
        lon,
        lat
      ]);
      
      imported++;
      
      // Progress indicator every 1000 records
      if (imported % 1000 === 0) {
        console.log(`   Imported ${imported} / ${data.length} chargers...`);
      }
    }
    
    console.log(`   ✅ Successfully imported ${imported} EV chargers`);
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped ${skipped} records (missing coordinates)`);
    }
    
  } catch (error) {
    console.error('   ❌ Error importing EV chargers:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// 4. Import Resale Transactions (LARGE FILE)
// ============================================
async function importResaleTransactions() {
  console.log('\n🏠 Importing Resale Transactions...');
  console.log('   ⏳ This may take 5-10 minutes for 217K+ records...');
  
  const client = await pool.connect();
  
  try {
    const dataPath = path.join(__dirname, '../../data/raw/ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv');
    
    if (!fs.existsSync(dataPath)) {
      console.log('   ⚠️  File not found:', dataPath);
      console.log('   Looking for file at:', dataPath);
      return;
    }
    
    console.log('   📖 Reading CSV file...');
    const data = await readCSV(dataPath);
    console.log(`   Found ${data.length} transactions`);
    
    // Batch insert for better performance
    const batchSize = 1000;
    let imported = 0;
    
    await client.query('BEGIN');
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const values = [];
      const placeholders = [];
      
      batch.forEach((row, index) => {
        const offset = index * 11;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`
        );
        
        values.push(
          cleanString(row.month),
          cleanString(row.town),
          cleanString(row.flat_type),
          cleanString(row.block),
          cleanString(row.street_name),
          cleanString(row.storey_range),
          cleanNumber(row.floor_area_sqm),
          cleanString(row.flat_model),
          cleanNumber(row.lease_commence_date),
          cleanString(row.remaining_lease),
          cleanNumber(row.resale_price)
        );
      });
      
      const query = `
        INSERT INTO resale_transaction (
          month, town, flat_type, block, street_name,
          storey_range, floor_area_sqm, flat_model,
          lease_commence_date, remaining_lease, resale_price
        ) VALUES ${placeholders.join(', ')}
      `;
      
      await client.query(query, values);
      imported += batch.length;
      
      // Progress indicator
      if (imported % 10000 === 0) {
        const percentage = ((imported / data.length) * 100).toFixed(1);
        console.log(`   Imported ${imported} / ${data.length} transactions (${percentage}%)...`);
      }
    }
    
    await client.query('COMMIT');
    console.log(`   ✅ Successfully imported ${imported} resale transactions`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('   ❌ Error importing resale transactions:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================
// Main execution
// ============================================
async function main() {
  console.log('========================================');
  console.log('🚀 Starting HDB Data Import');
  console.log('========================================');
  
  const startTime = Date.now();
  
  try {
    // Test database connection
    const testClient = await pool.connect();
    console.log('✅ Database connection successful');
    testClient.release();
    
    // Import in order (fastest first for quick feedback)
    await importMRTStations();        // ~171 records
    await importSchools();             // ~337 records
    await importEVChargers();          // ~9,384 records
    await importResaleTransactions();  // ~217,523 records (slowest)
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n========================================');
    console.log('✅ Import Complete!');
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log('========================================');
    
    // Print summary
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM mrt_station) as mrt_count,
        (SELECT COUNT(*) FROM school) as school_count,
        (SELECT COUNT(*) FROM ev_charger) as ev_count,
        (SELECT COUNT(*) FROM resale_transaction) as resale_count
    `);
    
    console.log('\n📊 Database Summary:');
    console.log(`   MRT Stations: ${stats.rows[0].mrt_count}`);
    console.log(`   Schools: ${stats.rows[0].school_count}`);
    console.log(`   EV Chargers: ${stats.rows[0].ev_count}`);
    console.log(`   Resale Transactions: ${stats.rows[0].resale_count}`);
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