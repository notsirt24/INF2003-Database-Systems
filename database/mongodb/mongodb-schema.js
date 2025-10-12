// ============================================
// HDB Smart Analytics Platform - MongoDB Schema
// File: database/mongodb/mongodb-schema.js
// ============================================

const mongoose = require('mongoose');

// ============================================
// 1. REVIEW SCHEMA (User reviews of HDB blocks)
// ============================================
const reviewSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  block_id: {
    type: Number,
    required: true,
    index: true
  },
  town: {
    type: String,
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    maxlength: 5000
  },
  pros: [String],
  cons: [String],
  categories: {
    location: { type: Number, min: 1, max: 5 },
    amenities: { type: Number, min: 1, max: 5 },
    transport: { type: Number, min: 1, max: 5 },
    neighborhood: { type: Number, min: 1, max: 5 },
    value_for_money: { type: Number, min: 1, max: 5 }
  },
  helpful_count: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for common queries
reviewSchema.index({ town: 1, rating: -1 });
reviewSchema.index({ created_at: -1 });
reviewSchema.index({ block_id: 1, status: 1 });

// ============================================
// 2. WATCHLIST SCHEMA (User's saved properties)
// ============================================
const watchlistSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  properties: [{
    flat_id: {
      type: Number,
      required: true
    },
    town: String,
    block: String,
    street_name: String,
    flat_type: String,
    note: String,
    price_alert_min: Number,
    price_alert_max: Number,
    added_at: {
      type: Date,
      default: Date.now
    },
    last_checked_price: Number,
    last_checked_at: Date
  }],
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Ensure one watchlist per user
watchlistSchema.index({ user_id: 1 }, { unique: true });

// ============================================
// 3. PRICE PREDICTION SCHEMA (ML model predictions)
// ============================================
const pricePredictionSchema = new mongoose.Schema({
  flat_id: {
    type: Number,
    required: true,
    index: true
  },
  town: String,
  flat_type: String,
  as_of_date: {
    type: Date,
    required: true,
    index: true
  },
  predicted_price: {
    type: Number,
    required: true
  },
  confidence_interval: {
    lower: Number,
    upper: Number
  },
  error_margin: {
    type: Number,
    default: 0
  },
  model_version: {
    type: String,
    required: true
  },
  features: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  actual_price: Number,  // Filled in later for validation
  accuracy: Number,  // Calculated after actual sale
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Composite index for querying latest predictions
pricePredictionSchema.index({ flat_id: 1, as_of_date: -1 });
pricePredictionSchema.index({ town: 1, flat_type: 1, as_of_date: -1 });

// ============================================
// 4. USER ACTIVITY SCHEMA (Analytics & behavior tracking)
// ============================================
const userActivitySchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  session_id: String,
  activity_type: {
    type: String,
    enum: ['search', 'view_property', 'save_watchlist', 'create_review', 'price_check', 'map_interaction'],
    required: true
  },
  details: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  // For search tracking
  search_query: String,
  search_filters: {
    town: String,
    flat_type: String,
    min_price: Number,
    max_price: Number,
    min_area: Number,
    max_area: Number
  },
  results_count: Number,
  // For property views
  property_id: Number,
  time_spent_seconds: Number,
  // Device info
  device_type: String,
  browser: String,
  ip_address: String,
  location: {
    country: String,
    city: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Indexes for analytics queries
userActivitySchema.index({ user_id: 1, timestamp: -1 });
userActivitySchema.index({ activity_type: 1, timestamp: -1 });
userActivitySchema.index({ timestamp: -1 });

// TTL index - auto-delete after 90 days
userActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// ============================================
// 5. MARKET ANALYTICS SCHEMA (Aggregated insights)
// ============================================
const marketAnalyticsSchema = new mongoose.Schema({
  analysis_type: {
    type: String,
    enum: ['town_trend', 'flat_type_trend', 'price_heatmap', 'demand_score'],
    required: true,
    index: true
  },
  town: {
    type: String,
    index: true
  },
  flat_type: String,
  time_period: {
    start_date: Date,
    end_date: Date
  },
  metrics: {
    avg_price: Number,
    median_price: Number,
    min_price: Number,
    max_price: Number,
    transaction_volume: Number,
    price_change_percent: Number,
    demand_score: Number,
    supply_score: Number
  },
  price_distribution: [{
    range: String,
    count: Number,
    percentage: Number
  }],
  top_blocks: [{
    block: String,
    street_name: String,
    avg_price: Number,
    transaction_count: Number
  }],
  computed_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Composite indexes
marketAnalyticsSchema.index({ analysis_type: 1, town: 1, computed_at: -1 });
marketAnalyticsSchema.index({ analysis_type: 1, flat_type: 1, computed_at: -1 });

// ============================================
// 6. NOTIFICATION SCHEMA (Price alerts, updates)
// ============================================
const notificationSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  notification_type: {
    type: String,
    enum: ['price_alert', 'new_listing', 'price_drop', 'market_update', 'review_response'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  related_property: {
    flat_id: Number,
    town: String,
    block: String,
    street_name: String
  },
  action_url: String,
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  read_at: Date,
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Composite index for fetching unread notifications
notificationSchema.index({ user_id: 1, is_read: 1, created_at: -1 });

// ============================================
// Create Models
// ============================================
const Review = mongoose.model('Review', reviewSchema);
const Watchlist = mongoose.model('Watchlist', watchlistSchema);
const PricePrediction = mongoose.model('PricePrediction', pricePredictionSchema);
const UserActivity = mongoose.model('UserActivity', userActivitySchema);
const MarketAnalytics = mongoose.model('MarketAnalytics', marketAnalyticsSchema);
const Notification = mongoose.model('Notification', notificationSchema);

// ============================================
// Initialization function
// ============================================
async function initializeDatabase(mongoUri) {
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB connected successfully');
    
    // Create indexes
    await Review.createIndexes();
    await Watchlist.createIndexes();
    await PricePrediction.createIndexes();
    await UserActivity.createIndexes();
    await MarketAnalytics.createIndexes();
    await Notification.createIndexes();
    
    console.log('✅ All indexes created successfully');
    
    // Insert sample data
    await insertSampleData();
    
    return {
      Review,
      Watchlist,
      PricePrediction,
      UserActivity,
      MarketAnalytics,
      Notification
    };
  } catch (error) {
    console.error('❌ MongoDB initialization error:', error);
    throw error;
  }
}

// ============================================
// Sample data insertion
// ============================================
async function insertSampleData() {
  console.log('📝 Inserting sample data...');
  
  // Sample reviews
  const sampleReviews = [
    {
      user_id: 'sample-user-1',
      block_id: 123,
      town: 'PUNGGOL',
      rating: 5,
      title: 'Great location near MRT and amenities',
      body: 'Living here for 2 years. Very convenient with MRT station within 5 mins walk. Many food options and shopping mall nearby. Highly recommended!',
      pros: ['Near MRT', 'Good food options', 'New development'],
      cons: ['Slightly pricey'],
      categories: {
        location: 5,
        amenities: 5,
        transport: 5,
        neighborhood: 4,
        value_for_money: 4
      },
      helpful_count: 15,
      status: 'approved'
    },
    {
      user_id: 'sample-user-2',
      block_id: 456,
      town: 'BISHAN',
      rating: 4,
      title: 'Mature estate with good connectivity',
      body: 'Excellent transport links with both NS and CC lines. Mature estate with established amenities. Great for families.',
      pros: ['Central location', 'Good schools', 'Junction 8 nearby'],
      cons: ['Older flats', 'Can be crowded'],
      categories: {
        location: 5,
        amenities: 5,
        transport: 5,
        neighborhood: 4,
        value_for_money: 3
      },
      helpful_count: 22,
      status: 'approved'
    }
  ];
  
  for (const review of sampleReviews) {
    await Review.findOneAndUpdate(
      { user_id: review.user_id, block_id: review.block_id },
      review,
      { upsert: true, new: true }
    );
  }
  
  console.log(`   ✅ Inserted ${sampleReviews.length} sample reviews`);
}

// ============================================
// Export
// ============================================
module.exports = {
  initializeDatabase,
  Review,
  Watchlist,
  PricePrediction,
  UserActivity,
  MarketAnalytics,
  Notification
};

// ============================================
// Run initialization if executed directly
// ============================================
if (require.main === module) {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hdb_analytics';
  
  initializeDatabase(mongoUri)
    .then(() => {
      console.log('\n========================================');
      console.log('✅ MongoDB initialization complete!');
      console.log('========================================');
      console.log('\nCollections created:');
      console.log('  - reviews');
      console.log('  - watchlists');
      console.log('  - pricepredictions');
      console.log('  - useractivities');
      console.log('  - marketanalytics');
      console.log('  - notifications');
      console.log('========================================\n');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    });
}