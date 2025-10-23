const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env' });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

// File paths - update these to your actual CSV file paths
const MRT_STATIONS_CSV = '/Users/weest/Downloads/MRT Stations.csv';
const SCHOOLS_CSV = '/Users/weest/Downloads/Generalinformationofschools.csv';
const BUS_STOPS_CSV = '/Users/weest/Downloads/lta_bus_stops.csv';
const EV_CHARGING_CSV = '/Users/weest/Downloads/Electric_Vehicle_Charging_Points.csv';

// OneMap API for geocoding (converting postal codes to lat/lng)
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';

// Helper function to geocode postal code using OneMap API
async function geocodePostalCode(postalCode) {
  try {
    const response = await fetch(`${ONEMAP_SEARCH_URL}?searchVal=${postalCode}&returnGeom=Y&getAddrDetails=Y&pageNum=1`);
    const data = await response.json();
    
    if (data.found > 0 && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        latitude: parseFloat(result.LATITUDE),
        longitude: parseFloat(result.LONGITUDE)
      };
    }
    return null;
  } catch (error) {
    console.error(`Error geocoding postal code ${postalCode}:`, error);
    return null;
  }
}

// Sleep function to avoid rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importMRTStations(db) {
  console.log('Importing MRT stations...');
  
  const mrtStations = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(MRT_STATIONS_CSV)
      .pipe(csv())
      .on('data', (row) => {
        // Parse the MRT station data
        const station = {
          objectid: parseInt(row.OBJECTID) || null,
          stn_name: row.STN_NAME || '',
          stn_no: row.STN_NO || '',
          latitude: parseFloat(row.Latitude) || 0,
          longitude: parseFloat(row.Longitude) || 0,
          location: {
            type: 'Point',
            coordinates: [parseFloat(row.Longitude) || 0, parseFloat(row.Latitude) || 0]
          }
        };
        
        if (station.latitude && station.longitude) {
          mrtStations.push(station);
        }
      })
      .on('end', async () => {
        try {
          // Drop existing collection
          await db.collection('mrt_stations').drop().catch(() => {});
          
          // Insert all MRT stations
          if (mrtStations.length > 0) {
            await db.collection('mrt_stations').insertMany(mrtStations);
            console.log(`✅ Imported ${mrtStations.length} MRT stations`);
            
            // Create geospatial index
            await db.collection('mrt_stations').createIndex({ location: '2dsphere' });
            console.log('✅ Created geospatial index for MRT stations');
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importSchools(db) {
  console.log('Importing schools...');
  
  const schools = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(SCHOOLS_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const school = {
          school_name: row.school_name || '',
          address: row.address || '',
          postal_code: row.postal_code || '',
          telephone_no: row.telephone_no || '',
          email_address: row.email_address || '',
          mrt_desc: row.mrt_desc || '',
          bus_desc: row.bus_desc || '',
          zone_code: row.zone_code || '',
          type_code: row.type_code || '',
          mainlevel_code: row.mainlevel_code || '',
          latitude: null,
          longitude: null,
          location: null
        };
        
        schools.push(school);
      })
      .on('end', async () => {
        try {
          console.log(`Processing ${schools.length} schools...`);
          
          // Geocode schools with postal codes
          let geocodedCount = 0;
          for (let i = 0; i < schools.length; i++) {
            if (schools[i].postal_code && schools[i].postal_code !== 'na') {
              const coords = await geocodePostalCode(schools[i].postal_code);
              if (coords) {
                schools[i].latitude = coords.latitude;
                schools[i].longitude = coords.longitude;
                schools[i].location = {
                  type: 'Point',
                  coordinates: [coords.longitude, coords.latitude]
                };
                geocodedCount++;
              }
              
              // Progress indicator
              if ((i + 1) % 10 === 0) {
                console.log(`Geocoded ${i + 1}/${schools.length} schools...`);
              }
              
              // Rate limiting - wait 100ms between requests
              await sleep(100);
            }
          }
          
          // Drop existing collection
          await db.collection('schools').drop().catch(() => {});
          
          // Insert all schools
          if (schools.length > 0) {
            await db.collection('schools').insertMany(schools);
            console.log(`✅ Imported ${schools.length} schools (${geocodedCount} geocoded)`);
            
            // Create geospatial index
            await db.collection('schools').createIndex({ location: '2dsphere' });
            console.log('✅ Created geospatial index for schools');
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importBusStops(db) {
  console.log('Importing bus stops...');
  
  const busStops = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(BUS_STOPS_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const busStop = {
          bus_stop_code: row.bus_stop_code || '',
          road_name: row.road_name || '',
          description: row.description || '',
          latitude: parseFloat(row.lat) || 0,
          longitude: parseFloat(row.lon) || 0,
          location: {
            type: 'Point',
            coordinates: [parseFloat(row.lon) || 0, parseFloat(row.lat) || 0]
          }
        };
        
        if (busStop.latitude && busStop.longitude) {
          busStops.push(busStop);
        }
      })
      .on('end', async () => {
        try {
          // Drop existing collection
          await db.collection('bus_stops').drop().catch(() => {});
          
          // Insert all bus stops
          if (busStops.length > 0) {
            await db.collection('bus_stops').insertMany(busStops);
            console.log(`✅ Imported ${busStops.length} bus stops`);
            
            // Create geospatial index
            await db.collection('bus_stops').createIndex({ location: '2dsphere' });
            console.log('✅ Created geospatial index for bus stops');
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function importEVCharging(db) {
  console.log('Importing EV charging stations...');
  
  const evStations = [];
  const seenLocations = new Map(); // To deduplicate by location
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(EV_CHARGING_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const latitude = parseFloat(row.Latitude);
        const longitude = parseFloat(row.Longitude);
        
        if (!latitude || !longitude) return;
        
        const locationKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
        
        // Check if we already have this location
        if (seenLocations.has(locationKey)) {
          // Update the existing station by incrementing charger count
          const existing = seenLocations.get(locationKey);
          existing.num_chargers += parseInt(row['No. of Charging Outlets']) || 1;
          
          // Add connector type if different
          const connectorType = row['Type of Connector'] || '';
          if (connectorType && !existing.connector_types.includes(connectorType)) {
            existing.connector_types.push(connectorType);
          }
        } else {
          // Create new station entry
          const station = {
            registration_code: row['EV Charger Registration Code'] || '',
            name: row.Name || '',
            num_chargers: parseInt(row['No. of Charging Outlets']) || 1,
            connector_types: [row['Type of Connector'] || ''],
            rated_power: parseFloat(row['Rated Output Power (kW)']) || 0,
            postal_code: row['Postal Code'] || '',
            block: row['Block/House No'] || '',
            street_name: row['Street Name'] || '',
            building_name: row['Building Name'] || '',
            is_public: row['Is the charger publicly accessible?'] === 'Yes',
            latitude: latitude,
            longitude: longitude,
            location: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          };
          
          evStations.push(station);
          seenLocations.set(locationKey, station);
        }
      })
      .on('end', async () => {
        try {
          // Drop existing collection
          await db.collection('ev_charging_stations').drop().catch(() => {});
          
          // Clean up connector_types arrays (join them into a string)
          evStations.forEach(station => {
            station.connector_types = [...new Set(station.connector_types)].join(', ');
          });
          
          // Insert all EV charging stations
          if (evStations.length > 0) {
            await db.collection('ev_charging_stations').insertMany(evStations);
            console.log(`✅ Imported ${evStations.length} EV charging stations`);
            
            // Create geospatial index
            await db.collection('ev_charging_stations').createIndex({ location: '2dsphere' });
            console.log('✅ Created geospatial index for EV charging stations');
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Import MRT stations
    await importMRTStations(db);
    
    // Import schools (with geocoding)
    await importSchools(db);
    
    // Import bus stops
    await importBusStops(db);
    
    // Import EV charging stations
    await importEVCharging(db);
    
    console.log('\n✅ All data imported successfully!');
    console.log('\nSummary:');
    console.log('- MRT Stations: Ready');
    console.log('- Schools: Ready (with geocoded locations)');
    console.log('- Bus Stops: Ready');
    console.log('- EV Charging Stations: Ready');
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed');
    }
  }
}

// Run the import
main();
