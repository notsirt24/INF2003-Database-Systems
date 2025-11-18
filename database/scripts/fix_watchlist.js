const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateWatchlistTable() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding missing columns to watchlist table...');
    
    // Add updated_at column
    await client.query(`ALTER TABLE watchlist ADD COLUMN updated_at TIMESTAMP`);
    console.log('   ✓ Added updated_at column');
    
    // Add removed_at column
    await client.query(`ALTER TABLE watchlist ADD COLUMN removed_at TIMESTAMP`);
    console.log('   ✓ Added removed_at column');
    
    // Add is_active column with default TRUE
    await client.query(`ALTER TABLE watchlist ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
    console.log('   ✓ Added is_active column');
    
    // Update existing records to be active
    await client.query(`UPDATE watchlist SET is_active = TRUE WHERE is_active IS NULL`);
    console.log('   ✓ Set existing records as active');
    
    console.log('✅ Watchlist table updated successfully!');
    
    // Show updated schema
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'watchlist' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Updated watchlist table columns:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateWatchlistTable();