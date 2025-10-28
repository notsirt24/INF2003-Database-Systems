-- ============================================
-- Performance Optimization: Materialized Views and Caching
-- ============================================

-- 1. Create Materialized View for Monthly Price Aggregations
CREATE MATERIALIZED VIEW mv_monthly_price_stats AS
SELECT 
    t.town_id,
    t.name as town_name,
    hf.flat_type,
    DATE_TRUNC('month', rt.contract_date) as month,
    AVG(rt.resale_price) as avg_price,
    STDDEV(rt.resale_price) as price_stddev,
    COUNT(*) as transaction_count,
    MIN(rt.resale_price) as min_price,
    MAX(rt.resale_price) as max_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rt.resale_price) as median_price
FROM resale_transaction rt
JOIN hdbflat hf ON rt.flat_id = hf.flat_id
JOIN hdbblock hb ON hf.block_id = hb.block_id
JOIN town t ON hb.town_id = t.town_id
GROUP BY t.town_id, t.name, hf.flat_type, DATE_TRUNC('month', rt.contract_date);

-- Create UNIQUE index first (required for CONCURRENT refresh)
CREATE UNIQUE INDEX idx_mv_monthly_unique ON mv_monthly_price_stats(town_id, flat_type, month);

-- Create additional indexes
CREATE INDEX idx_mv_monthly_month ON mv_monthly_price_stats(month);
CREATE INDEX idx_mv_monthly_town ON mv_monthly_price_stats(town_id);

-- 2. Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_monthly_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_price_stats;
END;
$$ LANGUAGE plpgsql;

-- 3. Add cache timestamp to price_prediction table
ALTER TABLE price_prediction 
ADD COLUMN IF NOT EXISTS cache_valid_until TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours');

-- 4. Create index for cache lookup optimization
CREATE INDEX IF NOT EXISTS idx_prediction_cache_lookup 
ON price_prediction(town_id, flat_type, cache_valid_until)
WHERE cache_valid_until > NOW();

-- 5. Update existing predictions to set cache validity
UPDATE price_prediction 
SET cache_valid_until = created_at + INTERVAL '24 hours'

-- 6. Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_predictions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM price_prediction
    WHERE cache_valid_until < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Create materialized view for all-town aggregations
CREATE MATERIALIZED VIEW mv_all_towns_monthly_stats AS
SELECT 
    hf.flat_type,
    DATE_TRUNC('month', rt.contract_date) as month,
    AVG(rt.resale_price) as avg_price,
    STDDEV(rt.resale_price) as price_stddev,
    COUNT(*) as transaction_count,
    MIN(rt.resale_price) as min_price,
    MAX(rt.resale_price) as max_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rt.resale_price) as median_price
FROM resale_transaction rt
JOIN hdbflat hf ON rt.flat_id = hf.flat_id
GROUP BY hf.flat_type, DATE_TRUNC('month', rt.contract_date);

-- Create UNIQUE index for concurrent refresh
CREATE UNIQUE INDEX idx_mv_all_towns_unique ON mv_all_towns_monthly_stats(flat_type, month);