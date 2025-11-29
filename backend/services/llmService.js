// backend/services/llmService.js
// COMPLETE - Price prediction + row limit + all fixes

const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set!');
}

async function callGemini(systemPrompt, userContent) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: systemPrompt + "\n\nUser message:\n" + userContent
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      topK: 20,
      topP: 0.9,
      maxOutputTokens: 2048,
    }
  };

  try {
    const res = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      timeout: 30000
    });

    const candidates = res.data.candidates || [];
    if (!candidates.length) {
      throw new Error("No response from Gemini");
    }

    const fullText = candidates[0]?.content?.parts?.map(p => p.text).join(" ") || "";
    return fullText.trim();
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    throw new Error('AI service temporarily unavailable');
  }
}

// Helper to normalize town names
function normalizeTownName(input) {
  if (!input) return null;
  
  const upper = input.toUpperCase().trim();
  
  const validTowns = [
    'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH', 
    'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG', 
    'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST', 
    'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL', 
    'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES', 
    'TOA PAYOH', 'WOODLANDS', 'YISHUN'
  ];
  
  if (validTowns.includes(upper)) return upper;
  
  const partialMatches = {
    'JURONG': 'JURONG WEST',
    'KALLANG': 'KALLANG/WHAMPOA',
    'AMK': 'ANG MO KIO',
    'CCK': 'CHOA CHU KANG',
    'TPY': 'TOA PAYOH'
  };
  
  if (partialMatches[upper]) {
    console.log(`📍 Town mapping: "${input}" → "${partialMatches[upper]}"`);
    return partialMatches[upper];
  }
  
  for (const town of validTowns) {
    if (town.includes(upper) || upper.includes(town.split(' ')[0])) {
      console.log(`📍 Town partial match: "${input}" → "${town}"`);
      return town;
    }
  }
  
  return upper;
}

// Helper to normalize flat type - DB uses "4 ROOM" (space, no hyphen)
function normalizeFlatType(input) {
  if (!input) return null;
  
  const lower = input.toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
  
  const flatTypeMap = {
    '1room': '1 ROOM',
    'oneroom': '1 ROOM',
    '2room': '2 ROOM',
    'tworoom': '2 ROOM',
    '3room': '3 ROOM',
    'threeroom': '3 ROOM',
    '4room': '4 ROOM',
    'fourroom': '4 ROOM',
    '5room': '5 ROOM',
    'fiveroom': '5 ROOM',
    'executive': 'EXECUTIVE'
  };
  
  return flatTypeMap[lower] || null;
}

async function extractIntentAndFilters(message) {
  const lowerMessage = message.toLowerCase();
  
  // PRE-PROCESSING: Detect flat type
  let detectedFlatType = null;
  const flatTypePatterns = [
    { pattern: /\b(1[\s-]?room|one[\s-]?room)\b/i, type: '1 ROOM' },
    { pattern: /\b(2[\s-]?room|two[\s-]?room)\b/i, type: '2 ROOM' },
    { pattern: /\b(3[\s-]?room|three[\s-]?room)\b/i, type: '3 ROOM' },
    { pattern: /\b(4[\s-]?room|four[\s-]?room)\b/i, type: '4 ROOM' },
    { pattern: /\b(5[\s-]?room|five[\s-]?room)\b/i, type: '5 ROOM' },
    { pattern: /\bexecutive\b/i, type: 'EXECUTIVE' }
  ];
  
  for (const { pattern, type } of flatTypePatterns) {
    if (pattern.test(message)) {
      detectedFlatType = type;
      console.log(`🏠 Detected flat type: ${type}`);
      break;
    }
  }
  
  // PRE-PROCESSING: Detect year/prediction year
  let detectedYear = null;
  let detectedStartYear = null;
  let detectedEndYear = null;
  let detectedPredictionYear = null;
  
  // Detect "in X years" for predictions (e.g., "in 10 years")
  const yearsAheadMatch = message.match(/in\s+(\d+)\s+years?/i);
  if (yearsAheadMatch) {
    const yearsAhead = parseInt(yearsAheadMatch[1]);
    const currentYear = new Date().getFullYear();
    detectedPredictionYear = currentYear + yearsAhead;
    console.log(`🔮 Prediction: ${yearsAhead} years ahead → year ${detectedPredictionYear}`);
  }
  
  // Match specific year like "in 2030", "by 2035"
  const specificYearMatch = message.match(/\b(?:in|by|for)\s+(20\d{2})\b/i);
  if (specificYearMatch && !yearsAheadMatch) {
    const year = parseInt(specificYearMatch[1]);
    const currentYear = new Date().getFullYear();
    
    // If future year + prediction keywords = prediction
    if (year > currentYear && (lowerMessage.includes('predict') || lowerMessage.includes('forecast') || lowerMessage.includes('future'))) {
      detectedPredictionYear = year;
      console.log(`🔮 Detected prediction year: ${year}`);
    } else {
      detectedYear = year;
      console.log(`📅 Detected historical year: ${year}`);
    }
  }
  
  // Match year range
  const yearRangeMatch = message.match(/(?:from|between)\s+(20\d{2})\s+(?:to|and|-)\s+(20\d{2})/i);
  if (yearRangeMatch) {
    detectedStartYear = parseInt(yearRangeMatch[1]);
    detectedEndYear = parseInt(yearRangeMatch[2]);
    console.log(`📅 Year range: ${detectedStartYear} to ${detectedEndYear}`);
  }
  
  // PRE-PROCESSING: Detect row limit
  let detectedLimit = null;
  const limitPatterns = [
    /show\s+(?:me\s+)?(\d+)\s+(?:rows?|results?|entries)/i,
    /(\d+)\s+(?:rows?|results?|entries)/i,
    /top\s+(\d+)/i,
    /first\s+(\d+)/i
  ];
  
  for (const pattern of limitPatterns) {
    const match = message.match(pattern);
    if (match) {
      detectedLimit = parseInt(match[1]);
      console.log(`📊 Detected row limit: ${detectedLimit}`);
      break;
    }
  }
  
  // PRE-PROCESSING: Detect price range
  let detectedMinPrice = null;
  let detectedMaxPrice = null;
  
  const underMatch = message.match(/(?:under|below|less than|cheaper than)\s*\$?\s*(\d+)k?/i);
  if (underMatch) {
    const value = underMatch[1];
    detectedMaxPrice = value.endsWith('k') ? parseInt(value) * 1000 : parseInt(value);
    console.log(`💰 Max price: ${detectedMaxPrice}`);
  }
  
  const overMatch = message.match(/(?:above|over|more than|expensive than)\s*\$?\s*(\d+)k?/i);
  if (overMatch) {
    const value = overMatch[1];
    detectedMinPrice = value.endsWith('k') ? parseInt(value) * 1000 : parseInt(value);
    console.log(`💰 Min price: ${detectedMinPrice}`);
  }
  
  const rangeMatch = message.match(/between\s*\$?\s*(\d+)k?\s*(?:and|to|-)\s*\$?\s*(\d+)k?/i);
  if (rangeMatch) {
    detectedMinPrice = rangeMatch[1].endsWith('k') ? parseInt(rangeMatch[1]) * 1000 : parseInt(rangeMatch[1]);
    detectedMaxPrice = rangeMatch[2].endsWith('k') ? parseInt(rangeMatch[2]) * 1000 : parseInt(rangeMatch[2]);
    console.log(`💰 Price range: ${detectedMinPrice} to ${detectedMaxPrice}`);
  }
  
  // PRE-PROCESSING: Detect intent
  let forcedIntent = null;
  
  if ((lowerMessage.includes('predict') || lowerMessage.includes('forecast') || 
       lowerMessage.includes('future') || yearsAheadMatch) &&
      (lowerMessage.includes('price') || lowerMessage.includes('cost'))) {
    forcedIntent = 'price_prediction';
  } else if ((lowerMessage.includes('compare') || lowerMessage.includes('comparison')) &&
      (lowerMessage.includes('between') || lowerMessage.includes('and'))) {
    forcedIntent = 'compare_towns';
  } else if ((lowerMessage.includes('popular') || lowerMessage.includes('most')) &&
             lowerMessage.includes('town')) {
    forcedIntent = 'popular_towns';
  } else if (lowerMessage.includes('cheapest') || lowerMessage.includes('affordable')) {
    forcedIntent = 'cheapest_options';
  } else if (lowerMessage.includes('most expensive') || lowerMessage.includes('highest price') ||
             lowerMessage.includes('priciest')) {
    forcedIntent = 'most_expensive';
  } else if (lowerMessage.includes('total') && lowerMessage.includes('transaction')) {
    forcedIntent = 'town_stats';
  } else if (lowerMessage.includes('trend') || (lowerMessage.includes('price') && lowerMessage.includes('change'))) {
    forcedIntent = 'price_trend';
  } else if (lowerMessage.includes('help') || lowerMessage === 'hi' || lowerMessage === 'hello') {
    forcedIntent = 'general';
  }

  const systemPrompt = `
Extract intent and filters from user query about Singapore HDB resale transactions.

TOWNS: ANG MO KIO, BEDOK, BISHAN, BUKIT BATOK, BUKIT MERAH, BUKIT PANJANG, BUKIT TIMAH, 
CENTRAL AREA, CHOA CHU KANG, CLEMENTI, GEYLANG, HOUGANG, JURONG EAST, JURONG WEST, 
KALLANG/WHAMPOA, MARINE PARADE, PASIR RIS, PUNGGOL, QUEENSTOWN, SEMBAWANG, SENGKANG, 
SERANGOON, TAMPINES, TOA PAYOH, WOODLANDS, YISHUN

FLAT TYPES: 1 ROOM, 2 ROOM, 3 ROOM, 4 ROOM, 5 ROOM, EXECUTIVE

INTENTS:
- price_prediction: Predict future prices
- search_flats: Find past transactions
- town_stats: Town statistics
- popular_towns: Most popular towns
- compare_towns: Compare two towns
- price_trend: Historical price trends
- cheapest_options: Find cheapest
- most_expensive: Find most expensive
- general: Help/greeting

Return ONLY JSON:
{
  "intent": "intent_name",
  "filters": {
    "town": "TOWN_NAME or null",
    "town2": "SECOND_TOWN or null",
    "flat_type": "FLAT_TYPE or null",
    "min_price": number or null,
    "max_price": number or null,
    "year": number or null,
    "start_year": number or null,
    "end_year": number or null,
    "prediction_year": number or null,
    "limit": number or null
  }
}
`;

  const raw = await callGemini(systemPrompt, message);

  try {
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    if (forcedIntent) parsed.intent = forcedIntent;
    if (detectedFlatType) parsed.filters.flat_type = detectedFlatType;
    
    if (parsed.filters.town) parsed.filters.town = normalizeTownName(parsed.filters.town);
    if (parsed.filters.town2) parsed.filters.town2 = normalizeTownName(parsed.filters.town2);
    
    if (detectedPredictionYear) parsed.filters.prediction_year = detectedPredictionYear;
    if (detectedYear) parsed.filters.year = detectedYear;
    if (detectedStartYear) parsed.filters.start_year = detectedStartYear;
    if (detectedEndYear) parsed.filters.end_year = detectedEndYear;
    if (detectedMinPrice !== null) parsed.filters.min_price = detectedMinPrice;
    if (detectedMaxPrice !== null) parsed.filters.max_price = detectedMaxPrice;
    if (detectedLimit) parsed.filters.limit = detectedLimit;
    
    if (parsed.filters.flat_type) {
      parsed.filters.flat_type = normalizeFlatType(parsed.filters.flat_type) || parsed.filters.flat_type;
    }

    console.log('🎯 Final Intent:', parsed.intent);
    console.log('🔍 Final Filters:', JSON.stringify(parsed.filters));
    
    return parsed;
  } catch (err) {
    console.error('❌ Parse error:', err.message);
    
    return {
      intent: forcedIntent || 'search_flats',
      filters: {
        town: null,
        town2: null,
        flat_type: detectedFlatType,
        min_price: detectedMinPrice,
        max_price: detectedMaxPrice,
        year: detectedYear,
        start_year: detectedStartYear,
        end_year: detectedEndYear,
        prediction_year: detectedPredictionYear,
        limit: detectedLimit
      }
    };
  }
}

async function generateAnswer(userMessage, intentObj, data) {
  if (intentObj.intent === 'general') {
    return `I'm your HDB Resale Analytics Assistant!

I help you analyze PAST HDB resale transactions (2017-2025) and predict future prices.

What I can do:
• Search transactions - "Show me 4-room flats in Tampines"
• Price predictions - "Predict 4-room price in Bedok in 10 years"
• Compare towns - "Compare Punggol and Sengkang"
• Price trends - "Price trend for 4-room in Bishan"
• Popular towns - "Which towns had most transactions?"
• Cheapest/Most expensive - "Most expensive 5-room in 2022"
• Custom row limits - "Show me 10 rows of data"

Available data: 26 towns, 1-ROOM to EXECUTIVE flats, years 2017-2025`;
  }

  // Handle empty results
  if ((data.count === 0 || (data.flats && data.flats.length === 0)) && intentObj.intent !== 'price_prediction') {
    let filterDesc = [];
    if (intentObj.filters.flat_type) filterDesc.push(`${intentObj.filters.flat_type} flats`);
    if (intentObj.filters.town) filterDesc.push(`in ${intentObj.filters.town}`);
    if (intentObj.filters.year) filterDesc.push(`in ${intentObj.filters.year}`);
    
    const filterStr = filterDesc.length > 0 ? filterDesc.join(' ') : 'with those filters';
    
    return `I couldn't find any past transactions ${filterStr}. Try broadening your search or check the town name.`;
  }

  const systemPrompt = `
You are analyzing Singapore HDB ${intentObj.intent === 'price_prediction' ? 'price predictions' : 'PAST resale transactions'}.

User asked: "${userMessage}"
Intent: "${intentObj.intent}"
Filters: ${JSON.stringify(intentObj.filters)}
Data: ${JSON.stringify(data, null, 2)}

RULES:
1. NO asterisks, NO markdown
2. For predictions, clearly state it's a prediction
3. For past data, say "past transactions"
4. Mention all applied filters
5. 3-5 sentences max
6. Plain text only

Response:
`;

  const answer = await callGemini(systemPrompt, JSON.stringify(data));
  return answer.replace(/\*\*/g, '').replace(/\*/g, '');
}

async function generateSmartAlternatives(userMessage, intentObj, availableTowns) {
  const systemPrompt = `
User query failed: "${userMessage}"
Available towns: ${availableTowns.slice(0, 10).join(', ')}

Generate helpful response with 3 similar working queries. Plain text, no asterisks.
`;

  const answer = await callGemini(systemPrompt, '');
  return answer.replace(/\*\*/g, '').replace(/\*/g, '');
}

module.exports = {
  extractIntentAndFilters,
  generateAnswer,
  generateSmartAlternatives
};