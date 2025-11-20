// database/mongodb/chatbot-analytics.js
// Simple Node script to list the top prompts users have asked the chatbot

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../scripts/.env' }); // adjust if your .env is elsewhere

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

async function showTopPrompts(limit = 10) {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);

    const pipeline = [
      { $group: { _id: '$message', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ];

    const results = await db.collection('chat_logs').aggregate(pipeline).toArray();

    console.log(`📊 Top ${limit} chatbot prompts:`);
    results.forEach((r, idx) => {
      console.log(`${idx + 1}. (${r.count} times) "${r._id}"`);
    });
  } catch (err) {
    console.error('Error running chatbot analytics:', err);
  } finally {
    await client.close();
  }
}

showTopPrompts(10);