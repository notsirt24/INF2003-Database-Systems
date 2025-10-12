-- ============================================
-- HDB Smart Analytics Platform - PostgreSQL Schema
-- Matches CSV file structure exactly
-- Database: hdb_analytics
-- ============================================

-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP TABLES (in reverse order of dependencies)
-- ============================================
DROP TABLE IF EXISTS resale_transaction CASCADE;
DROP TABLE IF EXISTS ev_charger CASCADE;
DROP TABLE IF EXISTS school CASCADE;
DROP TABLE IF EXISTS mrt_station CASCADE;
DROP TABLE IF EXISTS town CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- ============================================
-- USER TABLE (for app authentication)
-- ============================================
CREATE TABLE "user" (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin'))
);

CREATE INDEX idx_user_email ON "user"(email);

-- ============================================
-- TOWN TABLE
-- ============================================
CREATE TABLE town (
    town_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Insert towns from the resale data
INSERT INTO town (name) VALUES
('ANG MO KIO'), ('BEDOK'), ('BISHAN'), ('BUKIT BATOK'), ('BUKIT MERAH'),
('BUKIT PANJANG'), ('BUKIT TIMAH'), ('CENTRAL AREA'), ('CHOA CHU KANG'),
('CLEMENTI'), ('GEYLANG'), ('HOUGANG'), ('JURONG EAST'), ('JURONG WEST'),
('KALLANG/WHAMPOA'), ('MARINE PARADE'), ('PASIR RIS'), ('PUNGGOL'),
('QUEENSTOWN'), ('SEMBAWANG'), ('SENGKANG'), ('SERANGOON'), ('TAMPINES'),
('TOA PAYOH'), ('WOODLANDS'), ('YISHUN')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- RESALE TRANSACTION TABLE
-- Matches: ResaleflatpricesbasedonregistrationdatefromJan2017onwards.csv
-- ============================================
CREATE TABLE resale_transaction (
    transaction_id SERIAL PRIMARY KEY,
    month VARCHAR(7) NOT NULL,  -- Format: "2017-01"
    town VARCHAR(50) NOT NULL,
    flat_type VARCHAR(50) NOT NULL,
    block VARCHAR(10) NOT NULL,
    street_name VARCHAR(255) NOT NULL,
    storey_range VARCHAR(20) NOT NULL,
    floor_area_sqm DECIMAL(10, 2) NOT NULL,
    flat_model VARCHAR(100),
    lease_commence_date INTEGER,
    remaining_lease VARCHAR(50),  -- Format: "61 years 04 months"
    resale_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_resale_town ON resale_transaction(town);
CREATE INDEX idx_resale_flat_type ON resale_transaction(flat_type);
CREATE INDEX idx_resale_month ON resale_transaction(month);
CREATE INDEX idx_resale_price ON resale_transaction(resale_price);
CREATE INDEX idx_resale_block_street ON resale_transaction(block, street_name);

-- ============================================
-- MRT STATION TABLE
-- Matches: MRT Stations.csv
-- ============================================
CREATE TABLE mrt_station (
    station_id SERIAL PRIMARY KEY,
    object_id INTEGER,
    station_name VARCHAR(255) NOT NULL,
    station_code VARCHAR(10),  -- e.g., "EW7"
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOMETRY(Point, 4326)
);

-- Spatial index for proximity searches
CREATE INDEX idx_mrt_geom ON mrt_station USING GIST(geom);
CREATE INDEX idx_mrt_code ON mrt_station(station_code);

-- ============================================
-- SCHOOL TABLE
-- Matches: Generalinformationofschools.csv
-- ============================================
CREATE TABLE school (
    school_id SERIAL PRIMARY KEY,
    school_name VARCHAR(255) NOT NULL,
    url_address TEXT,
    address VARCHAR(500),
    postal_code VARCHAR(10),
    telephone_no VARCHAR(20),
    telephone_no_2 VARCHAR(20),
    fax_no VARCHAR(20),
    fax_no_2 VARCHAR(20),
    email_address VARCHAR(255),
    mrt_desc VARCHAR(255),
    bus_desc TEXT,
    principal_name VARCHAR(255),
    first_vp_name VARCHAR(255),
    second_vp_name VARCHAR(255),
    third_vp_name VARCHAR(255),
    fourth_vp_name VARCHAR(255),
    fifth_vp_name VARCHAR(255),
    sixth_vp_name VARCHAR(255),
    dgp_code VARCHAR(100),  -- Planning area/town
    zone_code VARCHAR(50),
    type_code VARCHAR(100),
    nature_code VARCHAR(100),
    session_code VARCHAR(50),
    mainlevel_code VARCHAR(50),  -- PRIMARY, SECONDARY, etc.
    sap_ind VARCHAR(10),
    autonomous_ind VARCHAR(10),
    gifted_ind VARCHAR(10),
    ip_ind VARCHAR(10),
    mothertongue1_code VARCHAR(50),
    mothertongue2_code VARCHAR(50),
    mothertongue3_code VARCHAR(50),
    latitude DECIMAL(10, 8),  -- To be geocoded from postal_code
    longitude DECIMAL(11, 8),  -- To be geocoded from postal_code
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_school_postal ON school(postal_code);
CREATE INDEX idx_school_level ON school(mainlevel_code);
CREATE INDEX idx_school_zone ON school(zone_code);
CREATE INDEX idx_school_geom ON school USING GIST(geom);

-- ============================================
-- EV CHARGER TABLE
-- Matches: Electric_Vehicle_Charging_Points.csv
-- ============================================
CREATE TABLE ev_charger (
    charger_id SERIAL PRIMARY KEY,
    registration_code VARCHAR(50) UNIQUE NOT NULL,
    operator_name VARCHAR(255),
    num_outlets INTEGER,
    connector_id VARCHAR(50),
    connector_type VARCHAR(50),
    rated_power_kw DECIMAL(10, 2),
    postal_code VARCHAR(10),
    block_house_no VARCHAR(50),
    street_name VARCHAR(255),
    building_name VARCHAR(255),
    floor_no VARCHAR(20),
    lot_no VARCHAR(20),
    publicly_accessible VARCHAR(10),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_ev_postal ON ev_charger(postal_code);
CREATE INDEX idx_ev_accessible ON ev_charger(publicly_accessible);
CREATE INDEX idx_ev_geom ON ev_charger USING GIST(geom);

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- View: Latest resale prices by town and flat type
CREATE OR REPLACE VIEW v_latest_prices AS
SELECT 
    town,
    flat_type,
    AVG(resale_price) as avg_price,
    MIN(resale_price) as min_price,
    MAX(resale_price) as max_price,
    COUNT(*) as transaction_count,
    MAX(month) as latest_month
FROM resale_transaction
WHERE month >= (
    SELECT MAX(month) 
    FROM resale_transaction
) - INTERVAL '12 months'
GROUP BY town, flat_type
ORDER BY town, flat_type;

-- View: Property with amenity counts (within 1km radius)
CREATE OR REPLACE VIEW v_property_amenity_summary AS
SELECT 
    rt.town,
    rt.block,
    rt.street_name,
    rt.flat_type,
    AVG(rt.resale_price) as avg_resale_price,
    COUNT(DISTINCT rt.transaction_id) as transaction_count,
    -- We'll add amenity counts after geocoding addresses
    MAX(rt.month) as latest_transaction_month
FROM resale_transaction rt
GROUP BY rt.town, rt.block, rt.street_name, rt.flat_type;

-- ============================================
-- USEFUL FUNCTIONS
-- ============================================

-- Function: Calculate distance between two points (in meters)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL,
    lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ST_Distance(
        ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography,
        ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography
    );
END;
$$ LANGUAGE plpgsql;

-- Function: Find nearby MRT stations
CREATE OR REPLACE FUNCTION find_nearby_mrt(
    p_lat DECIMAL,
    p_lon DECIMAL,
    p_radius_m INTEGER DEFAULT 1000
)
RETURNS TABLE (
    station_name VARCHAR,
    station_code VARCHAR,
    distance_m DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.station_name,
        m.station_code,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            m.geom::geography
        ) as distance_m
    FROM mrt_station m
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
        m.geom::geography,
        p_radius_m
    )
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- Function: Find nearby schools
CREATE OR REPLACE FUNCTION find_nearby_schools(
    p_lat DECIMAL,
    p_lon DECIMAL,
    p_radius_m INTEGER DEFAULT 1000
)
RETURNS TABLE (
    school_name VARCHAR,
    mainlevel_code VARCHAR,
    distance_m DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.school_name,
        s.mainlevel_code,
        ST_Distance(
            ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
            s.geom::geography
        ) as distance_m
    FROM school s
    WHERE s.geom IS NOT NULL
    AND ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
        s.geom::geography,
        p_radius_m
    )
    ORDER BY distance_m;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE resale_transaction IS 'HDB resale transactions from Jan 2017 onwards (217K+ records)';
COMMENT ON TABLE mrt_station IS 'MRT/LRT stations in Singapore (171 stations)';
COMMENT ON TABLE school IS 'Schools from primary to university level (337 schools)';
COMMENT ON TABLE ev_charger IS 'Electric vehicle charging points (9,384 chargers)';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created: 6';
    RAISE NOTICE '  - user (authentication)';
    RAISE NOTICE '  - town (26 Singapore towns)';
    RAISE NOTICE '  - resale_transaction (ready for 217K records)';
    RAISE NOTICE '  - mrt_station (ready for 171 records)';
    RAISE NOTICE '  - school (ready for 337 records)';
    RAISE NOTICE '  - ev_charger (ready for 9,384 records)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next step: Run data import scripts';
    RAISE NOTICE '========================================';
END $$;