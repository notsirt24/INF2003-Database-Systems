#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PHASE 2: AI ANALYSIS of Lemon8 Raw Posts
- Use Claude AI to classify reviews vs amenities
- Extract housing-related content
- Improve quality scoring and sentiment analysis
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import json
from anthropic import Anthropic

# UTF-8 encoding fix for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load environment
project_root = Path(__file__).parent.parent.parent
env_file = project_root / 'database' / 'scripts' / '.env'
if env_file.exists():
    load_dotenv(env_file)

# MongoDB setup
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_DB_NAME]

raw_posts_collection = db['lemon8_raw_posts']
reviews_collection = db['reviews']
dirty_data_collection = db['lemon8_dirty_data']
amenities_collection = db['amenities']

# Claude setup
api_key = os.getenv('ANTHROPIC_API_KEY')
claude_client = Anthropic()

# Singapore HDB estates (all regions)
SINGAPORE_ESTATES = [
    # Central
    'Bishan', 'Bukit Merah', 'Bukit Timah', 'Central Area', 'Geylang',
    'Kallang', 'Whampoa', 'Kallang/Whampoa', 'Marine Parade', 'Queenstown', 'Toa Payoh',
    
    # North
    'Ang Mo Kio', 'Sembawang', 'Woodlands', 'Yishun',
    
    # North-East
    'Hougang', 'Punggol', 'Sengkang', 'Serangoon',
    
    # East
    'Bedok', 'Pasir Ris', 'Tampines',
    
    # West
    'Bukit Batok', 'Bukit Panjang', 'Choa Chu Kang', 'Clementi',
    'Jurong East', 'Jurong West', 'Tengah',
    
    # North-West
    'Lim Chu Kang', 'Admiralty'
]

# Premium amenities/landmarks in Singapore
PREMIUM_AMENITIES = {
    'shopping': [
        'Ion Orchard', 'Ngee Ann City', 'Paragon', 'Takashimaya', 'Plaza Singapura',
        'Wisma Atria', 'Far East Plaza', 'Marina Bay Sands', 'VivoCity', 'Tampines Mall',
        'JCube', 'The Clementi Mall', 'Bukit Panjang Plaza', 'Bukit Batok Shopping Centre'
    ],
    'dining': [
        'hawker centre', 'food court', 'restaurant', 'cafe', 'coffee', 'bakery',
        'dim sum', 'chicken rice', 'laksa', 'roti prata', 'nasi lemak'
    ],
    'transport': [
        'MRT', 'LRT', 'bus', 'taxi', 'Grab', 'transport', 'commute', 'station',
        'interchange', 'connectivity', 'accessibility'
    ],
    'recreation': [
        'park', 'gym', 'swimming', 'sports', 'playground', 'community centre',
        'library', 'nature reserve', 'hiking', 'cycling'
    ],
    'education': [
        'school', 'childcare', 'kindergarten', 'tuition', 'university', 'academic'
    ],
    'healthcare': [
        'hospital', 'clinic', 'medical', 'healthcare', 'doctor', 'pharmacy', 'polyclinic'
    ],
    'safety': [
        'safe', 'security', 'crime', 'police', 'neighborhood watch', 'peacekeeping'
    ],
    'community': [
        'community', 'neighbors', 'friendly', 'resident', 'local', 'vibrant'
    ]
}

def analyze_with_claude(post_content, estate):
    """
    Use Claude to analyze if this is a genuine HDB review or dirty data
    """
    prompt = f"""Analyze this Lemon8 post about {estate} and determine if it's a GENUINE HDB/housing review.

POST CONTENT:
"{post_content}"

TASK: Respond ONLY with a JSON object (no markdown, no code blocks):
{{
    "is_review": true/false,
    "reason": "Brief reason why it is/isn't a review",
    "sentiment": "positive/neutral/negative",
    "key_points": ["list", "of", "key", "observations"],
    "pros": ["list", "of", "positive", "aspects"],
    "cons": ["list", "of", "negative", "aspects"]
}}

CRITERIA for IS_REVIEW=true:
- Discusses actual living experience in the HDB estate
- Mentions housing, amenities, neighbors, environment
- NOT just a product review (makeup, food, gadgets)
- NOT just promotional content
- Contains genuine opinions/experiences

CRITERIA for IS_REVIEW=false:
- Pure product/food review (makeup, skincare, snacks)
- Tourist guide (just listing places)
- Unrelated content (school reviews, product unboxing)
- Spam or promotional garbage
- No connection to housing/living experience

Sentiment should reflect OVERALL tone about living in that area."""

    try:
        response = claude_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        text = response.content[0].text.strip()
        
        # Try to parse JSON
        try:
            data = json.loads(text)
            return data
        except json.JSONDecodeError:
            # If Claude returns markdown, extract JSON
            if '```json' in text:
                json_str = text.split('```json')[1].split('```')[0].strip()
                data = json.loads(json_str)
                return data
            elif '{' in text:
                json_str = text[text.find('{'):text.rfind('}')+1]
                data = json.loads(json_str)
                return data
            else:
                return None
    except Exception as e:
        print(f"        Error calling Claude: {str(e)[:100]}")
        return None

def extract_estates_from_text(text):
    """
    Extract mentioned estates from text (case-insensitive)
    """
    mentioned = []
    text_lower = text.lower()
    
    for estate in SINGAPORE_ESTATES:
        if estate.lower() in text_lower:
            mentioned.append(estate)
    
    return list(set(mentioned))  # Remove duplicates

def extract_amenities(text):
    """
    Extract amenities mentioned in the text
    """
    amenities = {category: [] for category in PREMIUM_AMENITIES.keys()}
    text_lower = text.lower()
    
    for category, items in PREMIUM_AMENITIES.items():
        for item in items:
            if item.lower() in text_lower:
                # For shopping, avoid matching just "ion" in other words
                if category == 'shopping' and item.lower() == 'ion orchard':
                    if 'ion orchard' in text_lower or 'ion' in text_lower.split():
                        amenities[category].append(item)
                else:
                    amenities[category].append(item)
    
    # Remove empty categories
    amenities = {k: v for k, v in amenities.items() if v}
    return amenities

def process_raw_post(post, estate):
    """
    Process a single raw post: analyze with Claude, extract amenities, determine quality
    """
    post_text = post.get('full_text', '') or f"{post.get('title', '')} {post.get('content', '')}"
    
    # Get Claude analysis
    analysis = analyze_with_claude(post_text, estate)
    
    if not analysis:
        return None, "Failed to analyze with Claude"
    
    is_review = analysis.get('is_review', False)
    
    if not is_review:
        return None, analysis.get('reason', 'Not a housing review')
    
    # Extract amenities and estates
    mentioned_estates = extract_estates_from_text(post_text)
    amenities = extract_amenities(post_text)
    
    # Build review document
    review = {
        'source': 'lemon8',
        'estate': estate,
        'title': post.get('title', '')[:200],
        'content': post.get('content', '')[:1000],
        'full_text': post_text[:2000],
        
        # Analysis
        'sentiment': analysis.get('sentiment', 'neutral'),
        'key_points': analysis.get('key_points', [])[:5],
        'pros': analysis.get('pros', [])[:5],
        'cons': analysis.get('cons', [])[:5],
        
        # Amenities
        'mentioned_estates': mentioned_estates,
        'amenities_mentioned': amenities,
        
        # Source info
        'account_name': post.get('account_name', ''),
        'account_handle': post.get('account_handle', ''),
        'post_url': post.get('post_url', ''),
        'hashtags': post.get('hashtags', [])[:10],
        
        # Metadata
        'char_count': len(post_text),
        'quality_score': min(100, len(post_text) // 10 + (50 if amenities else 0)),
        'analyzed_at': datetime.now(),
        'phase': 2
    }
    
    return review, None

def main():
    print("\n" + "="*70)
    print("[LEMON8 PHASE 2 - ENHANCED] AI-Powered Review Analysis")
    print("="*70)
    print("Features:")
    print("   ✓ Claude AI for accurate review classification")
    print("   ✓ Improved sentiment detection")
    print("   ✓ Premium amenity extraction")
    print("   ✓ Better quality filtering")
    print("   ✓ Duplicate prevention")
    print("="*70 + "\n")
    
    # Check raw posts
    total_raw = raw_posts_collection.count_documents({})
    unprocessed = raw_posts_collection.count_documents({'processed': False})
    
    print(f"[Status]")
    print(f"   Total raw posts: {total_raw}")
    print(f"   Unprocessed: {unprocessed}")
    print(f"   Already processed: {total_raw - unprocessed}\n")
    
    if unprocessed == 0:
        print("   [No unprocessed posts! Run Phase 1 first.]\n")
        return
    
    print(f"[Processing] {unprocessed} posts...\n")
    
    # Get unprocessed posts
    posts = raw_posts_collection.find({'processed': False})
    
    reviews_created = 0
    dirty_count = 0
    error_count = 0
    
    for i, post in enumerate(posts, 1):
        estate = post.get('estate', 'Unknown')
        
        if i % 50 == 0 or i == 1:
            print(f"   [{i}/{unprocessed}] Processing {estate}...")
        
        # Analyze post
        review, error = process_raw_post(post, estate)
        
        if error:
            # Save to dirty data
            dirty_data_collection.insert_one({
                'raw_post_id': post['_id'],
                'estate': estate,
                'reason': error,
                'title': post.get('title', ''),
                'flagged_at': datetime.now()
            })
            dirty_count += 1
        else:
            # Check for duplicate
            existing = reviews_collection.find_one({
                'source': 'lemon8',
                'post_url': review['post_url']
            })
            
            if not existing:
                reviews_collection.insert_one(review)
                reviews_created += 1
            else:
                dirty_count += 1  # Count as duplicate
        
        # Mark as processed
        raw_posts_collection.update_one(
            {'_id': post['_id']},
            {
                '$set': {
                    'processed': True,
                    'analyzed_at': datetime.now(),
                    'error': error if error else None
                }
            }
        )
    
    # Summary
    print(f"\n" + "="*70)
    print(f"[RESULTS]")
    print(f"="*70)
    print(f"   Processed: {unprocessed}")
    print(f"   Reviews Created: {reviews_created}")
    print(f"   Flagged as Dirty: {dirty_count}")
    print(f"   Quality Rate: {(reviews_created/unprocessed)*100:.1f}%")
    
    # Stats
    total_reviews = reviews_collection.count_documents({'source': 'lemon8'})
    sentiment_counts = reviews_collection.aggregate([
        {'$match': {'source': 'lemon8'}},
        {'$group': {'_id': '$sentiment', 'count': {'$sum': 1}}}
    ])
    
    sentiment_dict = {item['_id']: item['count'] for item in sentiment_counts}
    
    print(f"\n[REVIEW BREAKDOWN]")
    print(f"   Total Reviews: {total_reviews}")
    print(f"   Positive: {sentiment_dict.get('positive', 0)}")
    print(f"   Neutral: {sentiment_dict.get('neutral', 0)}")
    print(f"   Negative: {sentiment_dict.get('negative', 0)}")
    
    # Top amenities
    top_amenities = reviews_collection.aggregate([
        {'$match': {'source': 'lemon8'}},
        {'$unwind': '$amenities_mentioned'},
        {'$group': {'_id': '$amenities_mentioned', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 10}
    ])
    
    print(f"\n[TOP AMENITIES MENTIONED]")
    for i, amenity in enumerate(top_amenities, 1):
        print(f"   {i}. {amenity['_id']}: {amenity['count']}")
    
    # Sample review
    sample = reviews_collection.findOne({'source': 'lemon8'})
    if sample:
        print(f"\n[SAMPLE REVIEW]")
        print(f"   Estate: {sample['estate']}")
        print(f"   Sentiment: {sample['sentiment']}")
        print(f"   Title: {sample['title'][:60]}...")
        print(f"   Key Points: {', '.join(sample.get('key_points', [])[:3])}")
        print(f"   Amenities: {list(sample.get('amenities_mentioned', {}).keys())[:3]}")
    
    print(f"\n" + "="*70 + "\n")
    
    client.close()

if __name__ == "__main__":
    main()
