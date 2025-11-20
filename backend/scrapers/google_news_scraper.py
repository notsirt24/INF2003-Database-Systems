#!/usr/bin/env python3
"""
Google News RSS Scraper - ENHANCED
Shows REAL source (99.co, PropertyGuru, etc.) instead of just "Google News"
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

project_root = Path(__file__).parent.parent.parent
env_file = project_root / 'database' / 'scripts' / '.env'

if env_file.exists():
    load_dotenv(env_file)

# MongoDB
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[MONGODB_DB_NAME]
    collection = db['newsarticles']
    client.server_info()
    print(f"✅ Connected to MongoDB: {MONGODB_DB_NAME}\n")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    exit(1)

analyzer = SentimentIntensityAnalyzer()

TOWNS = [
    'BISHAN', 'BUKIT MERAH', 'BUKIT TIMAH', 'CENTRAL AREA', 'GEYLANG', 'KALLANG','WHAMPOA', 'MARINE PARADE', 'QUEENSTOWN', 'TOA PAYOH',
    'ANG MO KIO', 'SEMBAWANG', 'WOODLANDS', 'YISHUN',
    'HOUGANG', 'PUNGGOL', 'SENGKANG', 'SERANGOON',
    'BEDOK', 'PASIR RIS', 'TAMPINES',
    'BUKIT BATOK', 'BUKIT PANJANG', 'CHOA CHU KANG', 'CLEMENTI', 'JURONG EAST', 'JURONG WEST',
    'LIM CHU KANG', 'SEMBAWANG', 'WOODLANDS', 'ADMIRALTY'
]

# Map sources to their type and official URLs
SOURCE_MAPPING = {
    # Property Portals
    '99.co': {
        'type': 'property_portal',
        'url': 'https://www.99.co',
        'aliases': ['99co', '99.co', 'ninetynine.co']
    },
    'PropertyGuru': {
        'type': 'property_portal',
        'url': 'https://www.propertyguru.com.sg',
        'aliases': ['propertyguru', 'property guru', 'pg']
    },
    'EdgeProp': {
        'type': 'property_portal',
        'url': 'https://www.edgeprop.sg',
        'aliases': ['edgeprop', 'edge prop', 'edge property']
    },
    'PropertyGuru Singapore': {
        'type': 'property_portal',
        'url': 'https://www.propertyguru.com.sg',
        'aliases': ['propertyguru singapore']
    },
    'SRX': {
        'type': 'property_portal',
        'url': 'https://www.srx.com.sg',
        'aliases': ['srx', 'srx.com.sg']
    },
    
    # News Media
    'The Straits Times': {
        'type': 'news_media',
        'url': 'https://www.straitstimes.com',
        'aliases': ['straits times', 'st', 'straitstimes']
    },
    'CNA': {
        'type': 'news_media',
        'url': 'https://www.channelnewsasia.com',
        'aliases': ['cna', 'channel news asia', 'channelnewsasia']
    },
    'TODAY': {
        'type': 'news_media',
        'url': 'https://www.todayonline.com',
        'aliases': ['today', 'todayonline']
    },
    'Business Times': {
        'type': 'news_media',
        'url': 'https://www.businesstimes.com.sg',
        'aliases': ['business times', 'bt', 'businesstimes']
    },
    'The Edge Singapore': {
        'type': 'news_media',
        'url': 'https://www.theedgesingapore.com',
        'aliases': ['edge singapore', 'the edge']
    },
    'Yahoo Singapore': {
        'type': 'news_media',
        'url': 'https://sg.news.yahoo.com',
        'aliases': ['yahoo singapore', 'yahoo sg']
    },
    
    # Government
    'HDB': {
        'type': 'government',
        'url': 'https://www.hdb.gov.sg',
        'aliases': ['hdb', 'housing development board']
    },
    'URA': {
        'type': 'government',
        'url': 'https://www.ura.gov.sg',
        'aliases': ['ura', 'urban redevelopment authority']
    },
    'LTA': {
        'type': 'government',
        'url': 'https://www.lta.gov.sg',
        'aliases': ['lta', 'land transport authority']
    }
}

def identify_source(source_name, article_url):
    """
    Identify the real source from the source name or URL
    Returns: (source_display_name, source_url, source_type)
    """
    if not source_name:
        source_name = ''
    
    source_name_lower = source_name.lower()
    
    # Check URL first (most reliable)
    if article_url:
        url_lower = article_url.lower()
        
        # Property Portals
        if '99.co' in url_lower or '99co' in url_lower:
            return '99.co', 'https://www.99.co', 'property_portal'
        if 'propertyguru' in url_lower:
            return 'PropertyGuru', 'https://www.propertyguru.com.sg', 'property_portal'
        if 'edgeprop' in url_lower:
            return 'EdgeProp', 'https://www.edgeprop.sg', 'property_portal'
        if 'srx.com' in url_lower:
            return 'SRX', 'https://www.srx.com.sg', 'property_portal'
        
        # News Media
        if 'straitstimes' in url_lower:
            return 'The Straits Times', 'https://www.straitstimes.com', 'news_media'
        if 'channelnewsasia' in url_lower or 'cna.com' in url_lower:
            return 'CNA', 'https://www.channelnewsasia.com', 'news_media'
        if 'todayonline' in url_lower or 'today.com' in url_lower:
            return 'TODAY', 'https://www.todayonline.com', 'news_media'
        if 'businesstimes' in url_lower:
            return 'Business Times', 'https://www.businesstimes.com.sg', 'news_media'
        if 'theedgesingapore' in url_lower:
            return 'The Edge Singapore', 'https://www.theedgesingapore.com', 'news_media'
        if 'yahoo' in url_lower:
            return 'Yahoo Singapore', 'https://sg.news.yahoo.com', 'news_media'
        
        # Government
        if 'hdb.gov' in url_lower:
            return 'HDB', 'https://www.hdb.gov.sg', 'government'
        if 'ura.gov' in url_lower:
            return 'URA', 'https://www.ura.gov.sg', 'government'
        if 'lta.gov' in url_lower:
            return 'LTA', 'https://www.lta.gov.sg', 'government'
    
    # Check source name
    for display_name, info in SOURCE_MAPPING.items():
        if any(alias in source_name_lower for alias in info['aliases']):
            return display_name, info['url'], info['type']
    
    # Default to source name if not matched
    return source_name if source_name else 'Unknown Source', 'https://news.google.com', 'news_aggregator'

def extract_locations(text):
    if not text:
        return []
    locations = set()
    text_upper = text.upper()
    for town in TOWNS:
        if town in text_upper:
            locations.add(town)
    return list(locations)

def fetch_article_content(url, timeout=8):
    """Fetch article content to extract locations"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Find article content
        article_selectors = ['article', '.article-content', '.story-body', 'main']
        content_text = ""
        
        for selector in article_selectors:
            article_elem = soup.select_one(selector)
            if article_elem:
                content_text = article_elem.get_text(separator=' ', strip=True)
                break
        
        # Fallback: get paragraphs
        if not content_text:
            paragraphs = soup.find_all('p')
            content_text = ' '.join([p.get_text(strip=True) for p in paragraphs[:15]])
        
        # Get description
        description = ""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            description = meta_desc['content']
        elif paragraphs := soup.find_all('p', limit=2):
            description = ' '.join([p.get_text(strip=True) for p in paragraphs])[:250]
        
        # Extract locations
        locations = extract_locations(content_text)
        
        return description, locations
        
    except Exception as e:
        return "", []

def categorize(title, description):
    text = f"{title} {description}".lower()
    cats = []
    
    if any(w in text for w in ['mrt', 'lrt', 'train', 'station', 'transport']):
        cats.extend(['mrt_expansion', 'infrastructure'])
    if any(w in text for w in ['bto', 'launch', 'development', 'build']):
        cats.append('new_development')
    if any(w in text for w in ['price', 'resale', 'market', 'sold', 'million', 'psf']):
        cats.extend(['market_trend', 'price_analysis'])
    if any(w in text for w in ['policy', 'grant', 'scheme']):
        cats.append('policy_change')
    if any(w in text for w in ['guide', 'tips', 'advice']):
        cats.append('buyer_guide')
    if any(w in text for w in ['investment', 'roi', 'rental']):
        cats.append('investment_insights')
    
    return list(set(cats)) if cats else ['general']

def analyze_sentiment(title):
    scores = analyzer.polarity_scores(title)
    compound = scores['compound']
    label = 'positive' if compound >= 0.1 else ('negative' if compound <= -0.1 else 'neutral')
    return {'score': round(compound, 2), 'label': label}

def assess_impact(categories, sentiment, locations):
    high_positive = ['mrt_expansion', 'infrastructure', 'new_development']
    moderate_positive = ['investment_insights', 'buyer_guide', 'policy_change']
    
    if any(cat in high_positive for cat in categories):
        impact = 'high_positive' if sentiment['label'] == 'positive' else 'moderate_positive'
    elif any(cat in moderate_positive for cat in categories):
        impact = 'moderate_positive'
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

def scrape_google_news_rss():
    """Scrape Google News RSS with real source attribution"""
    print("🔍 Scraping Google News RSS feeds...\n")
    
    articles = []
    rss_urls = [
        'https://news.google.com/rss/search?q=Singapore+HDB+resale&hl=en-SG&gl=SG&ceid=SG:en',
        'https://news.google.com/rss/search?q=Singapore+HDB+BTO&hl=en-SG&gl=SG&ceid=SG:en',
        'https://news.google.com/rss/search?q=Singapore+HDB+property&hl=en-SG&gl=SG&ceid=SG:en',
    ]
    
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    for rss_url in rss_urls:
        try:
            response = requests.get(rss_url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'xml')
            items = soup.find_all('item', limit=7)  # Get more articles
            
            for item in items:
                try:
                    title = item.find('title').get_text(strip=True)
                    link = item.find('link').get_text(strip=True)
                    pub_date_str = item.find('pubDate').get_text(strip=True) if item.find('pubDate') else None
                    
                    # Get source from RSS
                    source_elem = item.find('source')
                    rss_source_name = source_elem.get_text(strip=True) if source_elem else ''
                    
                    # Parse date
                    try:
                        pub_date = datetime.strptime(pub_date_str, '%a, %d %b %Y %H:%M:%S %Z')
                    except:
                        pub_date = datetime.now()
                    
                    # Skip if too old
                    if (datetime.now() - pub_date).days > 60:
                        continue
                    
                    # 🎯 IDENTIFY REAL SOURCE
                    real_source_name, real_source_url, source_type = identify_source(rss_source_name, link)
                    
                    print(f"   📰 {title[:50]}...")
                    print(f"      🏢 Source: {real_source_name} ({source_type})")
                    
                    # Get locations from title
                    locations_title = extract_locations(title)
                    
                    # Fetch article content
                    print(f"      🔗 Fetching content...", end='')
                    description, locations_content = fetch_article_content(link)
                    
                    # Combine locations
                    all_locations = list(set(locations_content + locations_title))
                    if not all_locations:
                        all_locations = ['NATIONWIDE']
                    
                    print(f" 📍 {', '.join(all_locations)}")
                    
                    # Analyze
                    categories = categorize(title, description)
                    sentiment = analyze_sentiment(title)
                    impact = assess_impact(categories, sentiment, all_locations)
                    keywords = [w.lower() for w in title.split() if len(w) > 4][:10]
                    
                    emoji = '😊' if sentiment['label'] == 'positive' else ('😐' if sentiment['label'] == 'neutral' else '😞')
                    print(f"      {emoji} {sentiment['label']} ({sentiment['score']}) | 🏷️  {', '.join(categories[:2])}\n")
                    
                    # Set relevance score based on source type
                    relevance_scores = {
                        'government': 0.95,
                        'property_portal': 0.90,
                        'news_media': 0.85,
                        'news_aggregator': 0.80
                    }
                    
                    article_data = {
                        'article_id': f"gnews-{int(pub_date.timestamp())}-{abs(hash(link)) % 100000}",
                        'title': title,
                        'description': description[:500] if description else f"Article from {real_source_name}",
                        'url': link,
                        'source': {
                            'name': real_source_name,  # 🎯 REAL SOURCE!
                            'url': real_source_url,
                            'type': source_type
                        },
                        'published_at': pub_date,
                        'locations': all_locations,
                        'categories': categories,
                        'sentiment': sentiment,
                        'impact_assessment': impact,
                        'keywords': keywords,
                        'relevance_score': relevance_scores.get(source_type, 0.85),
                        'view_count': 0,
                        'is_active': True,
                        'scraped_at': datetime.now(),
                        'last_updated': datetime.now()
                    }
                    
                    articles.append(article_data)
                    
                except Exception as e:
                    continue
            
            time.sleep(2)
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)}\n")
    
    return articles

def save_to_mongodb(articles):
    if not articles:
        return 0
    
    print(f"\n💾 Saving {len(articles)} articles...")
    
    saved = 0
    updated = 0
    
    for article in articles:
        try:
            if collection.find_one({'url': article['url']}):
                collection.update_one(
                    {'url': article['url']},
                    {'$set': {'last_updated': datetime.now(), 'locations': article['locations']}}
                )
                updated += 1
            else:
                collection.insert_one(article)
                saved += 1
        except Exception as e:
            print(f"   ⚠️  Error: {str(e)}")
    
    print(f"   ✅ Saved: {saved} | 🔄 Updated: {updated}")
    return saved

def main():
    print("\n" + "="*70)
    print("🗞️  GOOGLE NEWS SCRAPER - REAL SOURCE ATTRIBUTION")
    print("   Shows actual source: 99.co, PropertyGuru, CNA, etc.")
    print("="*70)
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    articles = scrape_google_news_rss()
    
    print("\n" + "="*70)
    print(f"📈 Found {len(articles)} articles")
    
    if articles:
        stats = {}
        for a in articles:
            stats[a['sentiment']['label']] = stats.get(a['sentiment']['label'], 0) + 1
        
        print(f"\n😊 Sentiment:")
        print(f"   Positive: {stats.get('positive', 0)} | "
              f"Neutral: {stats.get('neutral', 0)} | "
              f"Negative: {stats.get('negative', 0)}")
        
        # Show by source
        sources = {}
        for a in articles:
            src = f"{a['source']['name']} ({a['source']['type']})"
            sources[src] = sources.get(src, 0) + 1
        
        print(f"\n📊 By Source:")
        for src, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
            print(f"   {src}: {count} articles")
        
        save_to_mongodb(articles)
        
        print(f"\n📦 Total in database: {collection.count_documents({})}")
    
    client.close()
    print(f"\n✅ Done! {datetime.now().strftime('%H:%M:%S')}")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()