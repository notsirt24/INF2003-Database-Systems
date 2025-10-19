const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../database/scripts/.env' });

async function test() {
  console.log('Testing MongoDB connection...');
  console.log('URI:', process.env.MONGODB_URI);
  
  const client = new MongoClient(process.env.MONGODB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
    serverSelectionTimeoutMS: 10000,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!');
    const db = client.db(process.env.MONGODB_DB_NAME);
    const collections = await db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await client.close();
  }
}

test();