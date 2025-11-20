#!/usr/bin/env python3
"""
Official Government Sources Scraper - PROPERLY FILTERED
✅ ONLY: HDB flats, URA property data, LTA MRT expansion (property-relevant)
❌ EXCLUDES: Bus operations, awards, vocational licenses, general transport
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
from pymongo import MongoClient
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import os
from dotenv import load_dotenv
import time
from pathlib import Path
import re

# Load .env
project_root = Path(__file__).parent.parent.parent
env_file = project_root / 'database' / 'scripts' / '.env'

if env_file.exists():
    load_dotenv(env_file)
    print(f"✅ Loaded .env from: {env_file}\n")

MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_DB_NAME]
collection = db['newsarticles']

analyzer = SentimentIntensityAnalyzer()

TOWNS = [
    'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
    'BUKIT PANJANG', 'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST',
    'JURONG WEST', 'KALLANG', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
    'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
    'TENGAH', 'TOA PAYOH', 'WOODLANDS', 'YISHUN', 'CHOA CHU KANG',
    'BOON LAY', 'YEW TEE', 'CHANGI'
]

# ========== CRITICAL FILTERING KEYWORDS ==========

# ✅ REQUIRED: Must contain at least ONE of these (property-related)
REQUIRED_KEYWORDS = [
    'hdb', 'flat', 'bto', 'housing', 'resale', 'property', 'apartment',
    'unit', 'room', 'estate', 'town', 'neighbourhood', 'lease',
    'valuation', 'price', 'purchase', 'buyer', 'seller',
    'grant', 'subsidy', 'ballot', 'launch', 'cpf',
    'condo', 'condominium', 'home', 'real estate', 'mortgage',
    # MRT expansion (property-relevant)
    'mrt expansion', 'new mrt line', 'mrt station', 'rail expansion',
    'thomson-east coast line', 'circle line', 'downtown line',
    'jurong region line', 'cross island line'
]

# ❌ EXCLUDED: Immediate rejection if ANY of these found
EXCLUDED_KEYWORDS = [
    # Bus operations
    'bus driver', 'vocational licence', 'driving licence', 'bus service',
    'bus captain', 'bus operation', 'bus route', 'bus interchange',
    'bus stop', 'bus depot', 'feeder bus', 'express bus',
    
    # Awards & celebrations
    'excellence award', 'safety award', 'service award', 'best practice',
    'achiever', 'outstanding', 'award ceremony', 'recognition',
    'celebrates', 'commendation', 'honor', 'honours',
    
    # HR & recruitment
    'recruitment', 'job fair', 'career', 'internship', 'hiring',
    'scholarship', 'training program', 'workshop',
    
    # General transport (non-property)
    'road safety', 'traffic light', 'pedestrian crossing',
    'cycling', 'bicycle', 'pcn', 'park connector',
    'traffic management', 'road works', 'car park',
    
    # Non-property announcements
    'factsheet', 'advisory', 'reminder', 'notice', 'circular',
    'challenge shield', 'mot challenge', 'masterplan advisory'
]

def is_property_related(title, description=''):
    """
    STRICT FILTER: Only property/housing or MRT expansion (property-relevant)
    Returns True ONLY if:
    1. Contains required keywords AND
    2. Does NOT contain excluded keywords
    """
    text = f"{title} {description}".lower()
    
    # STEP 1: Check for excluded keywords first (immediate rejection)
    for excluded in EXCLUDED_KEYWORDS:
        if excluded.lower() in text:
            print(f"         ❌ EXCLUDED: '{excluded}' found")
            return False
    
    # STEP 2: Must contain at least ONE required keyword
    found_keywords = [kw for kw in REQUIRED_KEYWORDS if kw in text]
    
    if not found_keywords:
        print(f"         ❌ EXCLUDED: No property keywords")
        return False
    
    print(f"         ✅ RELEVANT: {', '.join(found_keywords[:2])}")
    return True

def extract_locations(text):
    if not text:
        return []
    locations = set()
    text_upper = text.upper()
    for town in TOWNS:
        if town in text_upper:
            locations.add(town)
    return list(locations)

def categorize(title, desc):
    text = f"{title} {desc}".lower()
    cats = []
    
    if any(w in text for w in ['mrt', 'lrt', 'line', 'rail', 'station']):
        cats.extend(['mrt_expansion', 'infrastructure'])
    if any(w in text for w in ['bto', 'launch', 'flat', 'tender', 'development']):
        cats.append('new_development')
    if any(w in text for w in ['price', 'resale', 'market', 'transaction']):
        cats.extend(['market_trend', 'price_analysis'])
    if any(w in text for w in ['policy', 'grant', 'scheme', 'regulation']):
        cats.append('policy_change')
    if any(w in text for w in ['masterplan', 'planning', 'urban']):
        cats.append('town_planning')
    
    return list(set(cats)) if cats else ['general']

def analyze_sentiment(title):
    scores = analyzer.polarity_scores(title)
    compound = scores['compound']
    label = 'positive' if compound >= 0.1 else ('negative' if compound <= -0.1 else 'neutral')
    return {'score': round(compound, 2), 'label': label}

def assess_impact(categories, sentiment, locations):
    high_positive = ['mrt_expansion', 'infrastructure', 'new_development']
    
    if any(cat in high_positive for cat in categories):
        impact = 'high_positive' if sentiment['label'] == 'positive' else 'moderate_positive'
    elif 'policy_change' in categories:
        impact = 'high_positive' if sentiment['label'] == 'positive' else 'moderate_positive'
    elif sentiment['label'] == 'negative':
        impact = 'moderate_negative'
    else:
        impact = 'neutral'
    
    timeframe = '2025-2030' if any(cat in ['mrt_expansion', 'new_development'] for cat in categories) else '2024-2026'
    
    return {
        'predicted_impact': impact,
        'affected_areas': locations if locations else ['NATIONWIDE'],
        'timeframe': timeframe
    }

def scrape_hdb():
    """Scrape HDB press releases - property only"""
    print("🏛️  Scraping HDB.gov.sg Press Releases...\n")
    articles = []
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        url = 'https://www.hdb.gov.sg/about-us/news-and-publications/press-releases'
        print(f"   📡 Fetching {url}...")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        print(f"   ✅ Status: {response.status_code}\n")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            try:
                title = link.get_text(strip=True)
                href = link['href']
                
                # Skip short titles or navigation elements
                if len(title) < 30:
                    continue
                
                if any(skip in title.lower() for skip in ['arrow', 'icon', 'button', 'menu']):
                    continue
                
                # Must be actual press release
                is_press_release = 'press-release' in href.lower()
                has_news_keywords = any(kw in title.lower() for kw in [
                    'hdb', 'launches', 'unveils', 'announces', 'tender', 
                    'bto', 'flats', 'opens', 'awards', 'extends'
                ])
                
                if not (is_press_release or has_news_keywords):
                    continue
                
                print(f"      📰 {title[:60]}...")
                
                # APPLY FILTER
                if not is_property_related(title):
                    print()  # Add spacing
                    continue
                
                if not href.startswith('http'):
                    href = 'https://www.hdb.gov.sg' + href
                
                locs = extract_locations(title) or ['NATIONWIDE']
                print(f"         📍 {', '.join(locs)}")
                
                cats = categorize(title, '')
                sent = analyze_sentiment(title)
                impact = assess_impact(cats, sent, locs)
                
                emoji = '😊' if sent['label'] == 'positive' else ('😐' if sent['label'] == 'neutral' else '😞')
                print(f"         {emoji} {sent['label']} | 🏷️  {', '.join(cats[:2])}\n")
                
                article = {
                    'article_id': f"hdb-gov-{int(datetime.now().timestamp())}-{abs(hash(href)) % 100000}",
                    'title': title,
                    'description': 'HDB press release on housing matters',
                    'url': href,
                    'source': {
                        'name': 'HDB',
                        'url': 'https://www.hdb.gov.sg',
                        'type': 'government'
                    },
                    'published_at': datetime.now(),
                    'locations': locs,
                    'categories': cats,
                    'sentiment': sent,
                    'impact_assessment': impact,
                    'keywords': [w.lower() for w in title.split() if len(w) > 4][:10],
                    'relevance_score': 0.95,
                    'view_count': 0,
                    'is_active': True,
                    'scraped_at': datetime.now(),
                    'last_updated': datetime.now()
                }
                
                articles.append(article)
                
                if len(articles) >= 15:
                    break
                
            except Exception as e:
                continue
    
    except Exception as e:
        print(f"   ❌ HDB error: {str(e)}\n")
    
    print(f"   ✅ HDB: {len(articles)} property articles\n")
    return articles

def scrape_ura():
    """Scrape URA press releases - property only"""
    print("🏛️  Scraping URA.gov.sg Press Releases...\n")
    articles = []
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        url = 'https://www.ura.gov.sg/Corporate/Media-Room/Media-Releases'
        print(f"   📡 Fetching {url}...")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        print(f"   ✅ Status: {response.status_code}\n")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        all_links = soup.find_all('a', href=True)
        
        for link in all_links:
            try:
                title = link.get_text(strip=True)
                href = link['href']
                
                if len(title) < 30:
                    continue
                
                # Must be actual media release
                if 'media-releases' not in href.lower():
                    continue
                
                print(f"      📰 {title[:60]}...")
                
                # APPLY FILTER
                if not is_property_related(title):
                    print()
                    continue
                
                if not href.startswith('http'):
                    href = 'https://www.ura.gov.sg' + href
                
                locs = extract_locations(title) or ['NATIONWIDE']
                print(f"         📍 {', '.join(locs)}")
                
                cats = categorize(title, '')
                sent = analyze_sentiment(title)
                impact = assess_impact(cats, sent, locs)
                
                emoji = '😊' if sent['label'] == 'positive' else ('😐' if sent['label'] == 'neutral' else '😞')
                print(f"         {emoji} {sent['label']} | 🏷️  {', '.join(cats[:2])}\n")
                
                article = {
                    'article_id': f"ura-gov-{int(datetime.now().timestamp())}-{abs(hash(href)) % 100000}",
                    'title': title,
                    'description': 'URA press release on property and urban planning',
                    'url': href,
                    'source': {
                        'name': 'URA',
                        'url': 'https://www.ura.gov.sg',
                        'type': 'government'
                    },
                    'published_at': datetime.now(),
                    'locations': locs,
                    'categories': cats,
                    'sentiment': sent,
                    'impact_assessment': impact,
                    'keywords': [w.lower() for w in title.split() if len(w) > 4][:10],
                    'relevance_score': 0.95,
                    'view_count': 0,
                    'is_active': True,
                    'scraped_at': datetime.now(),
                    'last_updated': datetime.now()
                }
                
                articles.append(article)
                
                if len(articles) >= 15:
                    break
                
            except Exception as e:
                continue
    
    except Exception as e:
        print(f"   ❌ URA error: {str(e)}\n")
    
    print(f"   ✅ URA: {len(articles)} property articles\n")
    return articles

def scrape_lta():
    """Scrape LTA - MRT expansion ONLY (property-relevant), NO bus operations/awards"""
    print("🏛️  Scraping LTA.gov.sg News Releases...\n")
    print("   ⚠️  FILTERING OUT: Bus operations, awards, licenses\n")
    articles = []
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        url = 'https://www.lta.gov.sg/content/ltagov/en/newsroom.html'
        print(f"   📡 Fetching {url}...")
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        print(f"   ✅ Status: {response.status_code}\n")
        
        soup = BeautifulSoup(response.content, 'html.parser')
        news_items = soup.find_all('li', class_='item')
        
        print(f"   📊 Found {len(news_items)} total news items\n")
        
        for item in news_items[:50]:
            try:
                title_elem = item.find('h5', class_='title')
                if not title_elem:
                    continue
                
                link_elem = title_elem.find('a', href=True)
                if not link_elem:
                    continue
                
                title = link_elem.get_text(strip=True)
                href = link_elem['href']
                
                if len(title) < 20:
                    continue
                
                print(f"      📰 {title[:60]}...")
                
                # APPLY STRICT FILTER - This will reject awards, bus operations, etc.
                if not is_property_related(title):
                    print()
                    continue
                
                if not href.startswith('http'):
                    href = 'https://www.lta.gov.sg' + href
                
                locs = extract_locations(title) or ['NATIONWIDE']
                print(f"         📍 {', '.join(locs)}")
                
                cats = categorize(title, '')
                sent = analyze_sentiment(title)
                impact = assess_impact(cats, sent, locs)
                
                emoji = '😊' if sent['label'] == 'positive' else ('😐' if sent['label'] == 'neutral' else '😞')
                print(f"         {emoji} {sent['label']} | 🏷️  {', '.join(cats[:2])}\n")
                
                article = {
                    'article_id': f"lta-gov-{int(datetime.now().timestamp())}-{abs(hash(href)) % 100000}",
                    'title': title,
                    'description': 'LTA news on MRT expansion and rail infrastructure',
                    'url': href,
                    'source': {
                        'name': 'LTA',
                        'url': 'https://www.lta.gov.sg',
                        'type': 'government'
                    },
                    'published_at': datetime.now(),
                    'locations': locs,
                    'categories': cats,
                    'sentiment': sent,
                    'impact_assessment': impact,
                    'keywords': [w.lower() for w in title.split() if len(w) > 4][:10],
                    'relevance_score': 0.90,
                    'view_count': 0,
                    'is_active': True,
                    'scraped_at': datetime.now(),
                    'last_updated': datetime.now()
                }
                
                articles.append(article)
                
                if len(articles) >= 10:
                    break
                
            except Exception as e:
                continue
    
    except Exception as e:
        print(f"   ❌ LTA error: {str(e)}\n")
    
    print(f"   ✅ LTA: {len(articles)} MRT expansion articles\n")
    return articles

def save_to_mongodb(articles):
    if not articles:
        print("\nNo articles to save\n")
        return
    
    print(f"\n💾 Saving {len(articles)} articles...")
    
    saved = 0
    updated = 0
    
    for article in articles:
        try:
            if collection.find_one({'url': article['url']}):
                collection.update_one(
                    {'url': article['url']},
                    {'$set': {'last_updated': datetime.now()}}
                )
                updated += 1
            else:
                collection.insert_one(article)
                saved += 1
        except Exception as e:
            print(f"   ⚠️  Error: {str(e)}")
    
    print(f"   ✅ Saved: {saved} | 🔄 Updated: {updated}")

def main():
    print("\n" + "="*70)
    print("🏛️  OFFICIAL GOVERNMENT SOURCES SCRAPER - PROPERLY FILTERED")
    print("="*70)
    print("\n✅ INCLUDES: HDB flats, URA property, LTA MRT expansion")
    print("❌ EXCLUDES: Bus operations, awards, vocational licenses\n")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    all_articles = []
    
    all_articles.extend(scrape_hdb())
    time.sleep(2)
    
    all_articles.extend(scrape_ura())
    time.sleep(2)
    
    all_articles.extend(scrape_lta())
    
    print("\n" + "="*70)
    print(f"📈 TOTAL FOUND: {len(all_articles)} articles")
    print("="*70)
    
    if all_articles:
        stats = {}
        for a in all_articles:
            stats[a['sentiment']['label']] = stats.get(a['sentiment']['label'], 0) + 1
        
        print(f"\n😊 Sentiment:")
        print(f"   Positive: {stats.get('positive', 0)} | "
              f"Neutral: {stats.get('neutral', 0)} | "
              f"Negative: {stats.get('negative', 0)}")
        
        sources = {}
        for a in all_articles:
            src = a['source']['name']
            sources[src] = sources.get(src, 0) + 1
        
        print(f"\n📊 By Source:")
        for src, count in sources.items():
            print(f"   {src}: {count} articles")
        
        save_to_mongodb(all_articles)
        
        print(f"\n📦 Total in database: {collection.count_documents({})}")
    
    client.close()
    print(f"\n✅ Complete! {datetime.now().strftime('%H:%M:%S')}")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()