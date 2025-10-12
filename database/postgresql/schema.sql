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
DROP TABLE IF EXISTS ev_charger CASCADE;
DROP TABLE IF EXISTS school CASCADE;
DROP TABLE IF EXISTS mrt_station CASCADE;
DROP TABLE IF EXISTS resale_transaction CASCADE;
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
    last_login_at TIMESTAMP
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
    month VARCHAR(7),
    town VARCHAR(50),
    flat_type VARCHAR(50),
    block VARCHAR(10),
    street_name VARCHAR(255),
    storey_range VARCHAR(20),
    floor_area_sqm DECIMAL(10, 2),
    flat_model VARCHAR(100),
    lease_commence_date INTEGER,
    remaining_lease VARCHAR(50),
    resale_price DECIMAL(12, 2)
);

CREATE INDEX idx_resale_town ON resale_transaction(town);
CREATE INDEX idx_resale_flat_type ON resale_transaction(flat_type);
CREATE INDEX idx_resale_price ON resale_transaction(resale_price);

-- ============================================
-- MRT STATION TABLE
-- Matches: MRT Stations.csv
-- ============================================
CREATE TABLE mrt_station (
    id SERIAL PRIMARY KEY,
    objectid INTEGER,
    stn_name VARCHAR(255),
    stn_no VARCHAR(10),
    geometry TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_mrt_latlong ON mrt_station(latitude, longitude);
CREATE INDEX idx_mrt_geom ON mrt_station USING GIST(geom);

-- ============================================
-- SCHOOL TABLE
-- Matches: Generalinformationofschools.csv
-- ============================================
CREATE TABLE school (
    school_id SERIAL PRIMARY KEY,
    school_name VARCHAR(255),
    url_address TEXT,
    address VARCHAR(500),
    postal_code VARCHAR(20),
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
    dgp_code VARCHAR(100),
    zone_code VARCHAR(50),
    type_code VARCHAR(100),
    nature_code VARCHAR(100),
    session_code VARCHAR(50),
    mainlevel_code VARCHAR(50),
    sap_ind VARCHAR(10),
    autonomous_ind VARCHAR(10),
    gifted_ind VARCHAR(10),
    ip_ind VARCHAR(10),
    mothertongue1_code VARCHAR(50),
    mothertongue2_code VARCHAR(50),
    mothertongue3_code VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_school_postal ON school(postal_code);
CREATE INDEX idx_school_geom ON school USING GIST(geom);

-- ============================================
-- EV CHARGER TABLE
-- Matches: Electric_Vehicle_Charging_Points.csv
-- ============================================
CREATE TABLE ev_charger (
    charger_id SERIAL PRIMARY KEY,
    ev_charger_registration_code VARCHAR(50),
    name VARCHAR(255),
    no_of_charging_outlets INTEGER,
    connector_id VARCHAR(50),
    type_of_connector VARCHAR(50),
    rated_output_power_kw DECIMAL(10, 2),
    postal_code VARCHAR(20),
    block_house_no VARCHAR(50),
    street_name VARCHAR(255),
    building_name VARCHAR(255),
    floor_no VARCHAR(20),
    lot_no VARCHAR(20),
    is_charger_publicly_accessible VARCHAR(10),
    longitude DECIMAL(11, 8),
    latitude DECIMAL(10, 8),
    geom GEOMETRY(Point, 4326)
);

CREATE INDEX idx_ev_postal ON ev_charger(postal_code);
CREATE INDEX idx_ev_geom ON ev_charger USING GIST(geom);