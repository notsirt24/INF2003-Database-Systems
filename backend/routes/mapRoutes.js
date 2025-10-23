const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

// GET /api/map/mrt-stations - Get all MRT stations
router.get('/mrt-stations', async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    
    const mrtStations = await db.collection('mrt_stations').find({}).toArray();
    res.json(mrtStations);
  } catch (error) {
    console.error('Error fetching MRT stations:', error);
    res.status(500).json({ error: 'Failed to fetch MRT stations', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/map/schools - Get all schools
router.get('/schools', async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    
    const schools = await db.collection('schools').find({}).toArray();
    res.json(schools);
  } catch (error) {
    console.error('Error fetching schools:', error);
    res.status(500).json({ error: 'Failed to fetch schools', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/map/bus-stops - Get all bus stops (limited for performance)
router.get('/bus-stops', async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    
    const busStops = await db.collection('bus_stops').find({}).toArray();
    res.json(busStops);
  } catch (error) {
    console.error('Error fetching bus stops:', error);
    res.status(500).json({ error: 'Failed to fetch bus stops', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/map/ev-charging - Get all EV charging stations
router.get('/ev-charging', async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);
    const { limit } = req.query;
    let cursor = db.collection('ev_charging_stations').find({});
    if (limit) {
      const n = parseInt(limit);
      if (!Number.isNaN(n) && n > 0) cursor = cursor.limit(n);
    }
    const evCharging = await cursor.toArray();
    res.json(evCharging);
  } catch (error) {
    console.error('Error fetching EV charging stations:', error);
    res.status(500).json({ error: 'Failed to fetch EV charging stations', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/map/ev-charging/stats - Get EV charging counts (total and unique by location)
router.get('/ev-charging/stats', async (req, res) => {
  let client;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    const total = await db.collection('ev_charging_stations').countDocuments({});
    const uniqueAgg = await db.collection('ev_charging_stations').aggregate([
      { $group: { _id: { lat: "$latitude", lng: "$longitude" }, count: { $sum: 1 } } },
      { $group: { _id: null, unique: { $sum: 1 } } }
    ]).toArray();
    const uniqueByLocation = uniqueAgg[0]?.unique || 0;

    res.json({ total, uniqueByLocation });
  } catch (error) {
    console.error('Error fetching EV charging stats:', error);
    res.status(500).json({ error: 'Failed to fetch EV charging stats', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// GET /api/map/nearby - Get nearby locations by type and coordinates
router.get('/nearby', async (req, res) => {
  let client;
  try {
    const { lat, lng, type, radius = 1000 } = req.query;
    
    if (!lat || !lng || !type) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lng, type' });
    }

    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    // Map type to collection name
    const collectionMap = {
      mrt: 'mrt_stations',
      school: 'schools',
      bus: 'bus_stops',
      ev: 'ev_charging_stations'
    };

    const collectionName = collectionMap[type];
    if (!collectionName) {
      return res.status(400).json({ error: 'Invalid type. Must be: mrt, school, bus, or ev' });
    }

    // MongoDB geospatial query for nearby locations
    const locations = await db.collection(collectionName).find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      }
    }).limit(50).toArray();

    res.json(locations);
  } catch (error) {
    console.error('Error fetching nearby locations:', error);
    res.status(500).json({ error: 'Failed to fetch nearby locations', details: error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

module.exports = router;
