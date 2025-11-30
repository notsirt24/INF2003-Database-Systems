// Chatbot Insights Analyzer
// Comprehensive analysis of user behavior and chatbot performance
// Run: node chatbot-insights.js

require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'hdb_analytics';

// Output storage
let outputLines = [];

// Helper function to log to both console and file
function log(message = '') {
  console.log(message);
  outputLines.push(message);
}

// Helper function to print section headers
function printHeader(title, char = '=') {
  log('\n' + char.repeat(80));
  log(`  ${title}`);
  log(char.repeat(80));
}

function printSubheader(title) {
  log('\n' + '-'.repeat(80));
  log(`  ${title}`);
  log('-'.repeat(80));
}

// Helper to create bar charts
function createBar(value, max, length = 50) {
  const barLength = Math.ceil((value / max) * length);
  return '█'.repeat(barLength);
}

async function analyzeUserQuestions() {
  if (!mongoUri) {
    log('MONGODB_URI not found in environment variables');
    return;
  }

  const client = new MongoClient(mongoUri);
  
  try {
    await client.connect();
    const db = client.db(dbName);
    
    printHeader('CHATBOT INSIGHTS & USER BEHAVIOR ANALYSIS', '=');
    log(`Generated: ${new Date().toLocaleString()}`);
    log(`Database: ${dbName}`);
    
    const chatLogs = db.collection('chat_logs');
    const failedQueries = db.collection('failed_queries');
    
    // ============================================================
    // 1. MOST ASKED QUESTIONS
    // ============================================================
    printHeader('TOP 20 MOST ASKED QUESTIONS');
    
    const mostAskedQueries = await chatLogs.aggregate([
      {
        $group: {
          _id: '$message',
          count: { $sum: 1 },
          successRate: { $avg: { $cond: ['$success', 1, 0] } },
          avgResults: { $avg: '$data_count' },
          intents: { $addToSet: '$intent' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]).toArray();
    
    log('\nRank | Count | Success | Question');
    log('-'.repeat(80));
    
    const maxCount = mostAskedQueries[0]?.count || 1;
    
    mostAskedQueries.forEach((query, idx) => {
      const successPercent = (query.successRate * 100).toFixed(0);
      const bar = createBar(query.count, maxCount, 20);
      
      log(`\n${String(idx + 1).padStart(2)}. [${query.count}x] ${successPercent}% success`);
      log(`    ${bar}`);
      log(`    "${query._id}"`);
      log(`    Intent(s): ${query.intents.join(', ')}`);
      log(`    Avg results: ${(query.avgResults || 0).toFixed(1)}`);
    });
    
    // ============================================================
    // 2. QUESTIONS BOT COULDN'T ANSWER (Failed Queries)
    // ============================================================
    printHeader('QUESTIONS THE BOT COULDN\'T ANSWER');
    
    const failedCount = await failedQueries.countDocuments();
    log(`\nTotal Failed Queries: ${failedCount}`);
    
    if (failedCount > 0) {
      // Most common failed queries
      const commonFailures = await failedQueries.aggregate([
        {
          $group: {
            _id: '$message',
            count: { $sum: 1 },
            errors: { $addToSet: '$error_message' },
            intents: { $addToSet: '$intent' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 15 }
      ]).toArray();
      
      log('\nTop 15 Failed Questions:');
      log('-'.repeat(80));
      
      commonFailures.forEach((failure, idx) => {
        log(`\n${idx + 1}. [Failed ${failure.count}x]`);
        log(`   Question: "${failure._id}"`);
        log(`   Intent(s): ${failure.intents.join(', ')}`);
        log(`   Error(s):`);
        failure.errors.forEach(err => {
          log(`     • ${err}`);
        });
      });
      
      // Failed queries by error type
      printSubheader('Error Type Distribution');
      
      const errorDistribution = await failedQueries.aggregate([
        {
          $group: {
            _id: '$error_message',
            count: { $sum: 1 },
            sampleQueries: { $push: '$message' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      errorDistribution.forEach((error, idx) => {
        log(`\n${idx + 1}. [${error.count} occurrences]`);
        log(`   Error: ${error._id}`);
        log(`   Sample queries:`);
        error.sampleQueries.slice(0, 3).forEach(q => {
          log(`     • "${q}"`);
        });
      });
    } else {
      log('\nNo failed queries found - Great job!');
    }
    
    // ============================================================
    // 3. LOW SUCCESS RATE QUERIES
    // ============================================================
    printHeader('QUERIES WITH LOW SUCCESS RATE (< 70%)');
    
    const lowSuccessQueries = await chatLogs.aggregate([
      {
        $group: {
          _id: '$message',
          count: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          failCount: { $sum: { $cond: ['$success', 0, 1] } },
          intents: { $addToSet: '$intent' }
        }
      },
      {
        $match: {
          count: { $gte: 3 } // At least 3 attempts
        }
      },
      {
        $project: {
          message: '$_id',
          count: 1,
          successCount: 1,
          failCount: 1,
          successRate: { $divide: ['$successCount', '$count'] },
          intents: 1
        }
      },
      {
        $match: {
          successRate: { $lt: 0.7 } // Less than 70% success
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    if (lowSuccessQueries.length > 0) {
      log('\nQueries that frequently fail:');
      log('-'.repeat(80));
      
      lowSuccessQueries.forEach((query, idx) => {
        const successPercent = (query.successRate * 100).toFixed(1);
        
        log(`\n${idx + 1}. Success Rate: ${successPercent}% (${query.successCount}/${query.count})`);
        log(`   "${query.message}"`);
        log(`   Intent(s): ${query.intents.join(', ')}`);
      });
    } else {
      log('\nNo queries with low success rates found!');
    }
    
    // ============================================================
    // 4. INTENT ANALYSIS
    // ============================================================
    printHeader('INTENT POPULARITY & SUCCESS RATES');
    
    const intentAnalysis = await chatLogs.aggregate([
      {
        $group: {
          _id: '$intent',
          totalQueries: { $sum: 1 },
          successCount: { $sum: { $cond: ['$success', 1, 0] } },
          avgResults: { $avg: '$data_count' },
          uniqueQuestions: { $addToSet: '$message' }
        }
      },
      {
        $project: {
          intent: '$_id',
          totalQueries: 1,
          successCount: 1,
          successRate: { $divide: ['$successCount', '$totalQueries'] },
          avgResults: 1,
          uniqueQuestionCount: { $size: '$uniqueQuestions' }
        }
      },
      { $sort: { totalQueries: -1 } }
    ]).toArray();
    
    log('\nIntent'.padEnd(25) + 'Queries'.padEnd(10) + 'Unique'.padEnd(10) + 'Success'.padEnd(10) + 'Avg Results');
    log('-'.repeat(80));
    
    const maxQueries = intentAnalysis[0]?.totalQueries || 1;
    
    intentAnalysis.forEach(intent => {
      const successPercent = (intent.successRate * 100).toFixed(1);
      const bar = createBar(intent.totalQueries, maxQueries, 20);
      
      log(
        `${(intent.intent || 'unknown').padEnd(25)}${String(intent.totalQueries).padEnd(10)}${String(intent.uniqueQuestionCount).padEnd(10)}${(successPercent + '%').padEnd(10)}${(intent.avgResults || 0).toFixed(1)}`
      );
      log(`  ${bar}`);
    });
    
    // ============================================================
    // 5. FILTER USAGE PATTERNS
    // ============================================================
    printHeader('WHAT USERS ARE SEARCHING FOR');
    
    // Top Towns
    printSubheader('Most Searched Towns');
    
    const topTowns = await chatLogs.aggregate([
      { $match: { 'filters.town': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$filters.town',
          searchCount: { $sum: 1 },
          intents: { $addToSet: '$intent' },
          avgResults: { $avg: '$data_count' }
        }
      },
      { $sort: { searchCount: -1 } },
      { $limit: 15 }
    ]).toArray();
    
    log('\nRank | Town'.padEnd(30) + 'Searches'.padEnd(12) + 'Avg Results'.padEnd(15) + 'Common Intents');
    log('-'.repeat(80));
    
    const maxTownSearches = topTowns[0]?.searchCount || 1;
    
    topTowns.forEach((town, idx) => {
      const bar = createBar(town.searchCount, maxTownSearches, 15);
      log(
        `${String(idx + 1).padStart(2)}. ${town._id.padEnd(27)}${String(town.searchCount).padEnd(12)}${(town.avgResults || 0).toFixed(1).padEnd(15)}${town.intents.slice(0, 2).join(', ')}`
      );
      log(`     ${bar}`);
    });
    
    // Top Flat Types
    printSubheader('Most Searched Flat Types');
    
    const topFlatTypes = await chatLogs.aggregate([
      { $match: { 'filters.flat_type': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$filters.flat_type',
          searchCount: { $sum: 1 },
          avgResults: { $avg: '$data_count' }
        }
      },
      { $sort: { searchCount: -1 } }
    ]).toArray();
    
    log('\nFlat Type'.padEnd(20) + 'Searches'.padEnd(12) + 'Avg Results');
    log('-'.repeat(50));
    
    topFlatTypes.forEach(flatType => {
      const bar = createBar(flatType.searchCount, topFlatTypes[0].searchCount, 20);
      log(
        `${flatType._id.padEnd(20)}${String(flatType.searchCount).padEnd(12)}${(flatType.avgResults || 0).toFixed(1)}`
      );
      log(`  ${bar}`);
    });
    
    // Price Range Searches
    printSubheader('Price Range Usage');
    
    const priceFilters = await chatLogs.aggregate([
      {
        $match: {
          $or: [
            { 'filters.min_price': { $ne: null } },
            { 'filters.max_price': { $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          withMinPrice: { $sum: { $cond: [{ $ne: ['$filters.min_price', null] }, 1, 0] } },
          withMaxPrice: { $sum: { $cond: [{ $ne: ['$filters.max_price', null] }, 1, 0] } },
          withBoth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$filters.min_price', null] },
                    { $ne: ['$filters.max_price', null] }
                  ]
                },
                1,
                0
              ]
            }
          },
          avgMinPrice: { $avg: '$filters.min_price' },
          avgMaxPrice: { $avg: '$filters.max_price' }
        }
      }
    ]).toArray();
    
    if (priceFilters.length > 0) {
      const stats = priceFilters[0];
      log(`\nQueries with minimum price filter: ${stats.withMinPrice}`);
      log(`Queries with maximum price filter: ${stats.withMaxPrice}`);
      log(`Queries with price range (both): ${stats.withBoth}`);
      if (stats.avgMinPrice) {
        log(`Average min price searched: $${Math.round(stats.avgMinPrice).toLocaleString()}`);
      }
      if (stats.avgMaxPrice) {
        log(`Average max price searched: $${Math.round(stats.avgMaxPrice).toLocaleString()}`);
      }
    }
    
    // Year Filters
    printSubheader('Year Filter Usage');
    
    const yearFilters = await chatLogs.aggregate([
      { $match: { 'filters.year': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$filters.year',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]).toArray();
    
    if (yearFilters.length > 0) {
      log('\nYear'.padEnd(10) + 'Searches');
      log('-'.repeat(30));
      yearFilters.forEach(year => {
        const bar = createBar(year.count, yearFilters[0].count, 20);
        log(`${String(year._id).padEnd(10)}${year.count} ${bar}`);
      });
    } else {
      log('\nNo specific year filters used');
    }
    
    // ============================================================
    // 6. TOWN + FLAT TYPE COMBINATIONS
    // ============================================================
    printHeader('POPULAR TOWN + FLAT TYPE COMBINATIONS');
    
    const combinations = await chatLogs.aggregate([
      {
        $match: {
          'filters.town': { $ne: null },
          'filters.flat_type': { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            town: '$filters.town',
            flatType: '$filters.flat_type'
          },
          count: { $sum: 1 },
          avgResults: { $avg: '$data_count' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 15 }
    ]).toArray();
    
    log('\nRank | Town + Flat Type'.padEnd(45) + 'Searches'.padEnd(12) + 'Avg Results');
    log('-'.repeat(80));
    
    combinations.forEach((combo, idx) => {
      const label = `${combo._id.town} - ${combo._id.flatType}`;
      log(
        `${String(idx + 1).padStart(2)}. ${label.padEnd(42)}${String(combo.count).padEnd(12)}${(combo.avgResults || 0).toFixed(1)}`
      );
    });
    
    // ============================================================
    // 7. PREDICTION QUERIES ANALYSIS
    // ============================================================
    printHeader('PRICE PREDICTION QUERIES');
    
    const predictionQueries = await chatLogs.aggregate([
      { $match: { intent: 'price_prediction' } },
      {
        $group: {
          _id: null,
          totalPredictions: { $sum: 1 },
          townsQueried: { $addToSet: '$filters.town' },
          flatTypesQueried: { $addToSet: '$filters.flat_type' },
          avgPredictionYear: { $avg: '$filters.prediction_year' },
          minYear: { $min: '$filters.prediction_year' },
          maxYear: { $max: '$filters.prediction_year' }
        }
      }
    ]).toArray();
    
    if (predictionQueries.length > 0) {
      const stats = predictionQueries[0];
      log(`\nTotal prediction queries: ${stats.totalPredictions}`);
      log(`Unique towns predicted: ${stats.townsQueried.filter(t => t).length}`);
      log(`Unique flat types predicted: ${stats.flatTypesQueried.filter(t => t).length}`);
      
      if (stats.avgPredictionYear) {
        log(`\nPrediction year range: ${stats.minYear} to ${stats.maxYear}`);
        log(`Average prediction year: ${Math.round(stats.avgPredictionYear)}`);
        
        const currentYear = new Date().getFullYear();
        const avgYearsAhead = Math.round(stats.avgPredictionYear - currentYear);
        log(`Users typically predict ${avgYearsAhead} years ahead`);
      }
      
      // Most predicted combinations
      printSubheader('Most Requested Predictions');
      
      const topPredictions = await chatLogs.aggregate([
        { $match: { intent: 'price_prediction' } },
        {
          $group: {
            _id: {
              town: '$filters.town',
              flatType: '$filters.flat_type',
              year: '$filters.prediction_year'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).toArray();
      
      log('\nRank | Prediction Query'.padEnd(55) + 'Count');
      log('-'.repeat(80));
      
      topPredictions.forEach((pred, idx) => {
        const query = `${pred._id.town} - ${pred._id.flatType} in ${pred._id.year}`;
        log(`${String(idx + 1).padStart(2)}. ${query.padEnd(52)}${pred.count}`);
      });
    } else {
      log('\nNo price prediction queries found');
    }
    
    // ============================================================
    // 8. COMPARISON QUERIES
    // ============================================================
    printHeader('COMPARISON QUERIES');
    
    const comparisonQueries = await chatLogs.aggregate([
      { $match: { intent: 'compare_towns' } },
      {
        $group: {
          _id: {
            town1: '$filters.town',
            town2: '$filters.town2'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();
    
    if (comparisonQueries.length > 0) {
      log('\nTop Town Comparisons:');
      log('-'.repeat(80));
      
      comparisonQueries.forEach((comp, idx) => {
        log(`${idx + 1}. ${comp._id.town1} vs ${comp._id.town2} - ${comp.count} times`);
      });
    } else {
      log('\nNo comparison queries found');
    }
    
    // ============================================================
    // 9. ACTIONABLE INSIGHTS
    // ============================================================
    printHeader('ACTIONABLE INSIGHTS & RECOMMENDATIONS');
    
    const totalChats = await chatLogs.countDocuments();
    const totalFailed = await failedQueries.countDocuments();
    const totalSuccess = await chatLogs.countDocuments({ success: true });
    
    const overallSuccessRate = ((totalSuccess / totalChats) * 100).toFixed(1);
    
    log(`\n Overall Performance:`);
    log(`   Total queries: ${totalChats.toLocaleString()}`);
    log(`   Successful: ${totalSuccess.toLocaleString()} (${overallSuccessRate}%)`);
    log(`   Failed: ${totalFailed.toLocaleString()}`);
    
    log(`\nKey Findings:`);
    
    // 1. Most popular intent
    const topIntent = intentAnalysis[0];
    if (topIntent) {
      log(`\n1. Most Popular Feature:`);
      log(`   "${topIntent.intent}" with ${topIntent.totalQueries} queries`);
      log(`   -> This is what users use most - ensure it works perfectly!`);
    }
    
    // 2. Least successful intent
    const problematicIntent = intentAnalysis
      .filter(i => i.totalQueries >= 5)
      .sort((a, b) => a.successRate - b.successRate)[0];
    
    if (problematicIntent && problematicIntent.successRate < 0.8) {
      log(`\n2. Needs Improvement:`);
      log(`   "${problematicIntent.intent}" has only ${(problematicIntent.successRate * 100).toFixed(1)}% success rate`);
      log(`   -> Review why this intent frequently fails`);
    }
    
    // 3. Most queried town
    if (topTowns.length > 0) {
      log(`\n3. Hottest Town:`);
      log(`   "${topTowns[0]._id}" with ${topTowns[0].searchCount} searches`);
      log(`   -> Consider adding more features for this town`);
    }
    
    // 4. Most queried flat type
    if (topFlatTypes.length > 0) {
      log(`\n4. Most Popular Flat Type:`);
      log(`   "${topFlatTypes[0]._id}" with ${topFlatTypes[0].searchCount} searches`);
      log(`   -> Ensure you have good data coverage for this flat type`);
    }
    
    // 5. Common failures
    if (totalFailed > 0) {
      log(`\n5. Failed Queries:`);
      log(`   ${totalFailed} queries failed`);
      log(`   -> Review failed_queries collection to improve bot responses`);
    }
    
    // 6. Data gaps
    const emptyResults = await chatLogs.countDocuments({ data_count: 0, success: true });
    if (emptyResults > 0) {
      const emptyPercent = ((emptyResults / totalChats) * 100).toFixed(1);
      log(`\n6. Data Gaps:`);
      log(`   ${emptyResults} queries (${emptyPercent}%) returned zero results`);
      log(`   -> Consider expanding your database or adjusting filters`);
    }
    
    // 7. User engagement
    const uniqueUsers = await chatLogs.distinct('user_id');
    const avgQueriesPerUser = (totalChats / uniqueUsers.length).toFixed(1);
    log(`\n7. User Engagement:`);
    log(`   ${uniqueUsers.length} unique users`);
    log(`   ${avgQueriesPerUser} queries per user on average`);
    if (avgQueriesPerUser > 5) {
      log(`   -> High engagement! Users find the bot useful`);
    } else {
      log(`   -> Consider improving user experience to increase engagement`);
    }
    
    printHeader('✨ ANALYSIS COMPLETE', '=');
    log('\nNext Steps:');
    log('1. Review failed queries to improve bot understanding');
    log('2. Optimize low-performing intents');
    log('3. Ensure good data coverage for popular towns/flat types');
    log('4. Consider adding features for common query patterns\n');
    
  } catch (error) {
    log('Error: ' + error.message);
    console.error(error);
  } finally {
    await client.close();
    
    // Export to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = 'chatbot_insights_' + timestamp + '.txt';
    fs.writeFileSync(filename, outputLines.join('\n'));
    console.log('\n\nResults exported to: ' + filename);
  }
}

// Run the analysis
analyzeUserQuestions();