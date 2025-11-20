#!/usr/bin/env python3
"""
Reddit HDB Reviews Scraper - FINAL VERSION
STRICT filtering for only genuine living experience reviews
NO politics, NO news, NO crime
"""

import praw
from prawcore.exceptions import TooManyRequests
from datetime import datetime
from pymongo import MongoClient
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import time
import re
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
project_root = Path(__file__).parent.parent.parent
env_file = project_root / 'database' / 'scripts' / '.env'
if env_file.exists():
    load_dotenv(env_file)

# MongoDB
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_DB_NAME]
reviews_collection = db['reviews']

# Initialize
sia = SentimentIntensityAnalyzer()
reddit = praw.Reddit(
    client_id=os.getenv('REDDIT_CLIENT_ID'),
    client_secret=os.getenv('REDDIT_CLIENT_SECRET'),
    user_agent='HDB Smart Analytics Review Scraper v3'
)

# Subreddits - Only discussion-focused ones
SUBREDDITS = ['askSingapore', 'singaporefi', 'singapore']

# Singapore regions and towns - MATCHES FRONTEND STRUCTURE
REGIONS = {
    'Central': ['BISHAN', 'BUKIT MERAH', 'BUKIT TIMAH', 'CENTRAL AREA', 'GEYLANG', 'KALLANG', 'MARINE PARADE', 'QUEENSTOWN', 'TOA PAYOH'],
    'North': ['ANG MO KIO', 'SEMBAWANG', 'WOODLANDS', 'YISHUN'],
    'North-East': ['HOUGANG', 'PUNGGOL', 'SENGKANG', 'SERANGOON'],
    'East': ['BEDOK', 'PASIR RIS', 'TAMPINES'],
    'West': ['BUKIT BATOK', 'BUKIT PANJANG', 'CHOA CHU KANG', 'CLEMENTI', 'JURONG EAST', 'JURONG WEST'],
    'North-West': ['LIM CHU KANG', 'SEMBAWANG', 'WOODLANDS', 'ADMIRALTY']
}

# Flatten to single list for backward compatibility
SINGAPORE_TOWNS = []
for region_towns in REGIONS.values():
    SINGAPORE_TOWNS.extend(region_towns)
SINGAPORE_TOWNS = list(set(SINGAPORE_TOWNS))  # Remove duplicates

# ⚠️ STRICT BLACKLIST - Much more comprehensive
BLACKLIST_KEYWORDS = [
    # Politics (EXPANDED)
    'opposition', 'pap', 'election', 'ge2025', 'ge 2025', 'mp ', ' mp', 'minister',
    'voting', 'vote', 'candidate', 'party', 'rally', 'grc', 'smc', 'wp ', ' wp',
    'workers party', "workers' party", 'government', 'parliament', 'mps',
    
    # Crime & Accidents
    'dies', 'died', 'death', 'dead', 'killed', 'murder', 'assault', 'stabbed',
    'fire', 'evacuated', 'accident', 'crash', 'suicide', 'assault', 'rape',
    'molest', 'abuse', 'arrest', 'police', 'scam', 'cheat', 'fraud',
    
    # News Events
    'breaking', 'breaking news', 'update', 'latest', 'just now', 'checkpoint',
    'queue', 'delay', 'closure', 'closed', 'shutdown', 'malfunction',
    
    # Unrelated
    'blocking', 'blocked', 'dbs', 'posb', 'bank', 'insurance', 'agent',
    'real estate agent', 'property agent', 'lawyer', 'legal', 'inheritance',
    'stadium', 'football', 'soccer', 'sports', 'match', 'game',
    
    # Random/Spam
    'ice cream', 'haircut', 'massage', 'clinic', 'tcm', 'pet shop',
    'stray cat', 'rat', 'bird', 'animal', 'durian', 'food court'
]

# ✅ MUST-HAVE phrases - Post MUST contain at least 2 of these
REQUIRED_PHRASES = [
    # Living experience
    'living in', 'live in', 'stay in', 'staying in', 'moved to', 'relocate',
    'bought', 'buying', 'purchase',
    
    # Questions
    'worth it', 'should i', 'advice', 'recommend', 'thoughts', 'opinion',
    'how is', 'anyone living', 'anyone staying',
    
    # Comparisons
    ' vs ', ' or ', 'better', 'worse', 'compare', 'comparison',
    
    # Reviews
    'pros and cons', 'pros cons', 'good and bad', 'like and dislike',
    'advantages', 'disadvantages', 'review',
    
    # BTO/Resale specific
    'bto', 'resale', 'flat', 'hdb'
]

def is_quality_review(title, selftext):
    """STRICT quality check with enhanced filtering"""
    full_text = f"{title} {selftext}".lower()
    
    # Skip if too short
    if len(full_text) < 150:
        return False
    
    # Skip if too long (likely copy-paste from articles)
    if len(full_text) > 10000:
        return False
    
    # Must have Singapore town
    has_town = any(town.lower() in full_text for town in SINGAPORE_TOWNS)
    if not has_town:
        return False
    
    # Must have at least 2 required phrases
    phrase_count = sum(1 for phrase in REQUIRED_PHRASES if phrase in full_text)
    if phrase_count < 2:
        return False
    
    # Must NOT have any blacklisted keywords
    for keyword in BLACKLIST_KEYWORDS:
        if keyword in full_text:
            return False
    
    # Prefer posts with personal experience markers
    experience_markers = ['i live', 'i stayed', 'we live', 'been living', 'moved', 'grew up', 'living here', 'staying here']
    has_personal = any(marker in full_text for marker in experience_markers)
    
    return True if has_personal else len(full_text) > 300  # Require longer posts without personal markers

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'[^\w\s.,!?-]', '', text)
    return text.strip()

def extract_towns(text):
    text_upper = text.upper()
    found = [town for town in SINGAPORE_TOWNS if town in text_upper]
    return found if found else ['NATIONWIDE']

def extract_pros_cons(text, comments):
    pros, cons = [], []
    full_text = f"{text} {' '.join(comments[:15])}".lower()
    
    # Positive
    pos_patterns = [
        r'pros?[:\s]+([^.!?\n]{20,200})',
        r'good[:\s]+([^.!?\n]{20,200})',
        r'(?:love|like)[:\s]+([^.!?\n]{20,200})',
        r'advantages?[:\s]+([^.!?\n]{20,200})',
        r'convenient[^.!?\n]{15,150}',
        r'accessible[^.!?\n]{15,150}'
    ]
    
    for pattern in pos_patterns:
        for match in re.finditer(pattern, full_text, re.IGNORECASE):
            pro = (match.group(1) if match.lastindex else match.group(0)).strip()
            if 20 <= len(pro) <= 200:
                pros.append(pro)
    
    # Negative
    neg_patterns = [
        r'cons?[:\s]+([^.!?\n]{20,200})',
        r'bad[:\s]+([^.!?\n]{20,200})',
        r'(?:hate|dislike)[:\s]+([^.!?\n]{20,200})',
        r'disadvantages?[:\s]+([^.!?\n]{20,200})',
        r'far from[^.!?\n]{15,150}',
        r'no (?:mrt|mall)[^.!?\n]{15,150}'
    ]
    
    for pattern in neg_patterns:
        for match in re.finditer(pattern, full_text, re.IGNORECASE):
            con = (match.group(1) if match.lastindex else match.group(0)).strip()
            if 20 <= len(con) <= 200:
                cons.append(con)
    
    return list(set(pros))[:5], list(set(cons))[:5]

def calculate_rating(sentiment_score):
    if sentiment_score >= 0.6:
        return 5
    elif sentiment_score >= 0.3:
        return 4
    elif sentiment_score >= -0.1:
        return 3
    elif sentiment_score >= -0.4:
        return 2
    else:
        return 1

def scrape_reddit():
    print("\n" + "="*70)
    print("🤖 REDDIT HDB REVIEWS SCRAPER v3.0 (STRICT FILTER)")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    reviews = []
    processed = set()
    skipped = 0
    
    # ✅ REGION-TARGETED SEARCH QUERIES - Enhanced for better results
    search_queries = []
    
    # Generate queries for each region
    for region, towns in REGIONS.items():
        # Living in queries for top towns
        for town in towns[:3]:
            search_queries.append(f'living in {town}')
            search_queries.append(f'is {town} worth it')
            search_queries.append(f'thinking of moving to {town}')
        
        # Comparisons within region
        if len(towns) >= 2:
            search_queries.append(f'{towns[0]} vs {towns[1]}')
        if len(towns) >= 3:
            search_queries.append(f'{towns[1]} vs {towns[2]}')
    
    # Add cross-region comparisons
    search_queries.extend([
        'Punggol vs Sengkang',
        'Bishan vs Toa Payoh',
        'Tampines vs Bedok',
        'East vs North-East HDB',
        'mature vs new estate',
        'which town has best MRT',
        'cheapest HDB area',
    ])
    
    # Add general experience queries
    search_queries.extend([
        'HDB living experience',
        'HDB flat review',
        'BTO or resale',
        'HDB amenities worth it',
        'HDB neighborhood review',
        'HDB transport access',
        'family friendly HDB area',
        'young professionals HDB'
    ])
    
    try:
        for subreddit_name in SUBREDDITS:
            print(f"\n📱 Scraping r/{subreddit_name}...")
            
            try:
                subreddit = reddit.subreddit(subreddit_name)
                
                for query in search_queries:
                    print(f"   🔍 '{query}'")
                    
                    try:
                        for submission in subreddit.search(query, sort='relevance', time_filter='year', limit=15):
                            if submission.id in processed:
                                continue
                            
                            # STRICT quality check
                            if not is_quality_review(submission.title, submission.selftext):
                                skipped += 1
                                continue
                            
                            processed.add(submission.id)
                            
                            # Extract data
                            full_content = f"{submission.title} {submission.selftext}"
                            towns = extract_towns(full_content)
                            
                            post_title = submission.title[:255]
                            post_content = clean_text(submission.selftext)[:2000]
                            post_datetime = datetime.fromtimestamp(submission.created_utc)
                            
                            # Get comments
                            try:
                                submission.comments.replace_more(limit=0)
                                comments = [
                                    clean_text(c.body)
                                    for c in submission.comments.list()[:20]
                                    if hasattr(c, 'body') and len(c.body) > 20
                                ]
                            except:
                                comments = []
                            
                            # Sentiment
                            full_text = f"{post_title} {post_content}"
                            sentiment = sia.polarity_scores(full_text)
                            compound = sentiment['compound']
                            rating = calculate_rating(compound)
                            
                            pros, cons = extract_pros_cons(full_text, comments)
                            
                            sentiment_label = 'positive' if compound >= 0.1 else ('negative' if compound <= -0.1 else 'neutral')
                            
                            # Determine region for this review
                            region = None
                            for reg, towns_in_region in REGIONS.items():
                                if any(town in towns for town in towns_in_region):
                                    region = reg
                                    break
                            
                            # Create review with enhanced metadata
                            review = {
                                'review_id': f"reddit-{submission.id}",
                                'user_id': str(submission.author) if submission.author else 'deleted',
                                'username': str(submission.author) if submission.author else '[deleted]',
                                'locations': towns,
                                'region': region,  # Add region for easier filtering
                                'rating': rating,
                                'title': post_title,
                                'body': post_content,
                                'pros': pros,
                                'cons': cons,
                                'sentiment': {
                                    'label': sentiment_label,
                                    'score': round(compound, 2)
                                },
                                'helpful_count': submission.score,
                                'comment_count': submission.num_comments,
                                'status': 'approved',
                                'source': {
                                    'platform': 'Reddit',
                                    'subreddit': subreddit_name,
                                    'url': f"https://reddit.com{submission.permalink}"
                                },
                                'created_at': post_datetime,
                                'scraped_at': datetime.now(),
                                'is_active': True,
                                'quality_score': round((len(pros) + len(cons)) / 2 + abs(compound), 2)  # Score for ranking
                            }
                            
                            reviews.append(review)
                            print(f"      ✓ {post_title[:60]}... ({', '.join(towns[:2])}, {rating}⭐)")
                        
                        time.sleep(2)
                        
                    except TooManyRequests:
                        print(f"   ⚠️  Rate limit. Waiting...")
                        time.sleep(60)
                    except Exception as e:
                        print(f"   ⚠️  Error: {str(e)[:50]}")
                        continue
                    
            except Exception as e:
                print(f"   ❌ Error: {str(e)[:50]}")
                continue
        
    except Exception as e:
        print(f"❌ Critical error: {str(e)}")
    
    print(f"\n📊 Filtered out {skipped} low-quality posts")
    return reviews

def save_to_mongodb(reviews):
    if not reviews:
        print("\n⚠️  No reviews to save")
        return 0
    
    print(f"\n💾 Saving {len(reviews)} reviews...")
    
    try:
        saved = updated = 0
        
        for review in reviews:
            try:
                result = reviews_collection.update_one(
                    {'review_id': review['review_id']},
                    {'$set': review},
                    upsert=True
                )
                
                if result.upserted_id:
                    saved += 1
                elif result.modified_count > 0:
                    updated += 1
            except Exception as e:
                print(f"   ⚠️  Error: {str(e)[:50]}")
                continue
        
        print(f"   ✅ New: {saved}, Updated: {updated}")
        return saved + updated
        
    except Exception as e:
        print(f"\n❌ MongoDB error: {str(e)}")
        return 0

def main():
    try:
        reddit.user.me()
        print("✅ Reddit authenticated\n")
    except Exception as e:
        print(f"❌ Auth failed: {str(e)}\n")
        return
    
    reviews = scrape_reddit()
    
    print("\n" + "="*70)
    print("📊 SUMMARY")
    print("="*70)
    print(f"Total quality reviews: {len(reviews)}")
    
    if reviews:
        from collections import Counter
        
        ratings = Counter(r['rating'] for r in reviews)
        print(f"\n⭐ Ratings:")
        for r in sorted(ratings.keys(), reverse=True):
            print(f"   {r}⭐: {ratings[r]}")
        
        sentiments = Counter(r['sentiment']['label'] for r in reviews)
        print(f"\n😊 Sentiment:")
        for s, c in sentiments.items():
            emoji = '😊' if s == 'positive' else ('😐' if s == 'neutral' else '😞')
            print(f"   {emoji} {s}: {c}")
        
        all_towns = []
        for r in reviews:
            all_towns.extend(r['locations'])
        towns = Counter(all_towns)
        print(f"\n📍 Top Locations:")
        for t, c in towns.most_common(10):
            print(f"   {t}: {c}")
        
        save_to_mongodb(reviews)
        total = reviews_collection.count_documents({})
        print(f"\n📦 Total in DB: {total}")
    
    print(f"\n✅ Done: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70 + "\n")
    
    client.close()

if __name__ == "__main__":
    main()