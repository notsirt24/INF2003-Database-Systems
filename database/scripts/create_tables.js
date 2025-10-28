// Create all normalized tables via Node.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log('🗑️  Dropping old tables...');
    
    // Drop old tables
    await client.query(`
      DROP TABLE IF EXISTS ev_charger CASCADE;
      DROP TABLE IF EXISTS mrt_station CASCADE;
      DROP TABLE IF EXISTS school CASCADE;
      DROP TABLE IF EXISTS review CASCADE;
      DROP TABLE IF EXISTS watchlist CASCADE;
      DROP TABLE IF EXISTS price_prediction CASCADE;
      DROP TABLE IF EXISTS flat_amenity_proximity CASCADE;
      DROP TABLE IF EXISTS amenity CASCADE;
      DROP TABLE IF EXISTS resale_transaction CASCADE;
      DROP TABLE IF EXISTS hdbflat CASCADE;
      DROP TABLE IF EXISTS hdbblock CASCADE;
      DROP TABLE IF EXISTS town CASCADE;
      DROP TABLE IF EXISTS "user" CASCADE;
    `);
    console.log('✅ Old tables dropped');
    
    console.log('\n🔨 Creating new tables...');
    
    // Enable extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create USER table
    console.log('   Creating user table...');
    await client.query(`
      CREATE TABLE "user" (
        user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX idx_user_email ON "user"(email)');
    
    // Create TOWN table
    console.log('   Creating town table...');
    await client.query(`
      CREATE TABLE town (
        town_id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL
      )
    `);
    await client.query('CREATE INDEX idx_town_name ON town(name)');
    
    // Insert towns
    await client.query(`
      INSERT INTO town (name) VALUES
      ('ANG MO KIO'), ('BEDOK'), ('BISHAN'), ('BUKIT BATOK'), ('BUKIT MERAH'),
      ('BUKIT PANJANG'), ('BUKIT TIMAH'), ('CENTRAL AREA'), ('CHOA CHU KANG'),
      ('CLEMENTI'), ('GEYLANG'), ('HOUGANG'), ('JURONG EAST'), ('JURONG WEST'),
      ('KALLANG/WHAMPOA'), ('MARINE PARADE'), ('PASIR RIS'), ('PUNGGOL'),
      ('QUEENSTOWN'), ('SEMBAWANG'), ('SENGKANG'), ('SERANGOON'), ('TAMPINES'),
      ('TOA PAYOH'), ('WOODLANDS'), ('YISHUN')
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Create HDBBLOCK table
    console.log('   Creating hdbblock table...');
    await client.query(`
      CREATE TABLE hdbblock (
        block_id SERIAL PRIMARY KEY,
        town_id INT NOT NULL REFERENCES town(town_id),
        block_no VARCHAR(10) NOT NULL,
        street_name VARCHAR(255) NOT NULL,
        postal_code VARCHAR(20),
        completion_year INT,
        max_floor_level INT,
        lease_commence_year INT,
        total_dwelling_units INT,
        geom GEOMETRY(Point, 4326),
        UNIQUE(block_no, street_name, town_id)
      )
    `);
    await client.query('CREATE INDEX idx_hdbblock_town ON hdbblock(town_id)');
    await client.query('CREATE INDEX idx_hdbblock_location ON hdbblock(block_no, street_name)');
    await client.query('CREATE INDEX idx_hdbblock_geom ON hdbblock USING GIST(geom)');
    
    // Create HDBFLAT table
    console.log('   Creating hdbflat table...');
    await client.query(`
      CREATE TABLE hdbflat (
        flat_id SERIAL PRIMARY KEY,
        block_id INT NOT NULL REFERENCES hdbblock(block_id),
        flat_type VARCHAR(50) NOT NULL,
        floor_area_sqm DECIMAL(10, 2),
        storey_range VARCHAR(20),
        remaining_lease_years INT,
        model VARCHAR(100)
      )
    `);
    await client.query('CREATE INDEX idx_hdbflat_block ON hdbflat(block_id)');
    await client.query('CREATE INDEX idx_hdbflat_type ON hdbflat(flat_type)');
    await client.query('CREATE INDEX idx_hdbflat_area ON hdbflat(floor_area_sqm)');
    
    // Create AMENITY table
    console.log('   Creating amenity table...');
    await client.query(`
      CREATE TABLE amenity (
        amenity_id SERIAL PRIMARY KEY,
        amenity_type VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        operator VARCHAR(255),
        code VARCHAR(50),
        geom GEOMETRY(Point, 4326),
        meta TEXT
      )
    `);
    await client.query('CREATE INDEX idx_amenity_type ON amenity(amenity_type)');
    await client.query('CREATE INDEX idx_amenity_geom ON amenity USING GIST(geom)');
    
    // Create RESALE_TRANSACTION table
    console.log('   Creating resale_transaction table...');
    await client.query(`
      CREATE TABLE resale_transaction (
        transaction_id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES hdbflat(flat_id),
        contract_date DATE NOT NULL,
        resale_price DECIMAL(12, 2) NOT NULL,
        price_psm DECIMAL(10, 2),
        remaining_lease_years_at_sale INT,
        buyer_segment VARCHAR(50),
        source_ref VARCHAR(100),
        ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX idx_resale_flat ON resale_transaction(flat_id)');
    await client.query('CREATE INDEX idx_resale_date ON resale_transaction(contract_date)');
    await client.query('CREATE INDEX idx_resale_price ON resale_transaction(resale_price)');
    
    // Create FLAT_AMENITY_PROXIMITY table
    console.log('   Creating flat_amenity_proximity table...');
    await client.query(`
      CREATE TABLE flat_amenity_proximity (
        proximity_id SERIAL PRIMARY KEY,
        flat_id INT NOT NULL REFERENCES hdbflat(flat_id),
        amenity_id INT NOT NULL REFERENCES amenity(amenity_id),
        distance_m DECIMAL(10, 2),
        walk_time_min DECIMAL(10, 2),
        transit_time_min DECIMAL(10, 2),
        proximity_rank INT,
        computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(flat_id, amenity_id)
      )
    `);
    await client.query('CREATE INDEX idx_proximity_flat ON flat_amenity_proximity(flat_id)');
    await client.query('CREATE INDEX idx_proximity_amenity ON flat_amenity_proximity(amenity_id)');
    await client.query('CREATE INDEX idx_proximity_distance ON flat_amenity_proximity(distance_m)');
    
    // Create PRICE_PREDICTION table
    console.log('   Creating price_prediction table...');
    await client.query(`
      CREATE TABLE price_prediction (
        prediction_id SERIAL PRIMARY KEY,
        town_id INT REFERENCES town(town_id),
        flat_type VARCHAR(50) NOT NULL,
        prediction_year INT NOT NULL,
        prediction_month INT NOT NULL,
        predicted_price DECIMAL(12, 2) NOT NULL,
        confidence_lower DECIMAL(12, 2),
        confidence_upper DECIMAL(12, 2),
        base_price DECIMAL(12, 2),
        yoy_growth_rate DECIMAL(5, 2),
        model_version VARCHAR(50) DEFAULT 'linear_trend_v1',
        features JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(town_id, flat_type, prediction_year, prediction_month)
      )
    `);
    await client.query('CREATE INDEX idx_prediction_town_type ON price_prediction(town_id, flat_type)');
    await client.query('CREATE INDEX idx_prediction_year ON price_prediction(prediction_year)');
    await client.query('CREATE INDEX idx_prediction_date ON price_prediction(prediction_year, prediction_month)');

    // Make town_id nullable for price_prediction
    await client.query('ALTER TABLE price_prediction ALTER COLUMN town_id DROP NOT NULL;');
    
    // Create WATCHLIST table
    console.log('   Creating watchlist table...');
    await client.query(`
      CREATE TABLE watchlist (
        watchlist_id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES "user"(user_id),
        flat_id INT NOT NULL REFERENCES hdbflat(flat_id),
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, flat_id)
      )
    `);
    await client.query('CREATE INDEX idx_watchlist_user ON watchlist(user_id)');
    await client.query('CREATE INDEX idx_watchlist_flat ON watchlist(flat_id)');
    
    // Create REVIEW table
    console.log('   Creating review table...');
    await client.query(`
      CREATE TABLE review (
        review_id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES "user"(user_id),
        block_id INT REFERENCES hdbblock(block_id),
        town_id INT REFERENCES town(town_id),
        transaction_id INT REFERENCES resale_transaction(transaction_id),
        rating INT CHECK (rating >= 1 AND rating <= 5),
        title VARCHAR(255),
        body TEXT,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query('CREATE INDEX idx_review_user ON review(user_id)');
    await client.query('CREATE INDEX idx_review_block ON review(block_id)');
    await client.query('CREATE INDEX idx_review_town ON review(town_id)');
    await client.query('CREATE INDEX idx_review_rating ON review(rating)');
    
    console.log('\n✅ All tables created successfully!');
    
    // Verify tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables in database:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();