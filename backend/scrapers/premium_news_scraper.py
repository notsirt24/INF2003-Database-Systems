"""
High-Quality Property News Scraper
Focuses ONLY on HDB/property-related news from premium sources

Sources:
1. Business Times - HDB keyword
2. The Straits Times - HDB keyword  
3. CNA - HDB topic
4. PropertyGuru Singapore News
5. 99.co Singapore Insights

Filters OUT irrelevant content like:
- Bus operations, driver licenses
- Awards ceremonies (unless property-related)
- General transport news
- Unrelated government announcements
"""

import os
import sys
from datetime import datetime
import time
from dotenv import load_dotenv
from pymongo import MongoClient
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import hashlib
import re

# Load environment
load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')

# Keywords that MUST be present (property-related)
REQUIRED_KEYWORDS = [
    'hdb', 'flat', 'bto', 'housing', 'resale', 'property', 'apartment',
    'unit', 'room', 'estate', 'town', 'neighbourhood', 'lease',
    'valuation', 'price', 'sale', 'purchase', 'buyer', 'seller',
    'grant', 'subsidy', 'eligibility', 'ballot', 'launch', 'cpf'
]

# Keywords that indicate IRRELEVANT content (filter OUT)
EXCLUDED_KEYWORDS = [
    'bus driver', 'vocational licence', 'driving', 'bus service',
    'mrt station staff', 'train operator', 'bus captain',
    'excellence award', 'safety award', 'service award',
    'recruitment', 'job fair', 'career', 'internship',
    'road safety', 'traffic light', 'pedestrian crossing',
    'cycling', 'bicycle', 'pcn', 'park connector'
]

def setup_driver():
    """Setup Selenium WebDriver with Chrome"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def is_property_related(title, description):
    """
    Strict filter: Only property/housing-related content
    Returns True if content is relevant, False otherwise
    """
    text = f"{title} {description}".lower()
    
    # Check for excluded keywords first (immediate rejection)
    for excluded in EXCLUDED_KEYWORDS:
        if excluded.lower() in text:
            print(f"   ❌ EXCLUDED: Contains '{excluded}'")
            return False
    
    # Must contain at least one required keyword
    found_keywords = [kw for kw in REQUIRED_KEYWORDS if kw in text]
    
    if not found_keywords:
        print(f"   ❌ EXCLUDED: No property keywords found")
        return False
    
    print(f"   ✅ RELEVANT: Found keywords: {', '.join(found_keywords[:3])}")
    return True

def generate_article_id(source, url, published_date):
    """Generate unique article ID"""
    unique_string = f"{source}-{url}-{published_date}"
    return hashlib.md5(unique_string.encode()).hexdigest()[:16]

def analyze_sentiment(text):
    """Simple sentiment analysis"""
    text_lower = text.lower()
    
    positive_words = ['launch', 'new', 'increase', 'growth', 'boost', 'improve', 
                      'upgrade', 'benefit', 'success', 'positive', 'rise', 'up']
    negative_words = ['decline', 'drop', 'decrease', 'fall', 'shortage', 'concern',
                      'issue', 'problem', 'crisis', 'delay', 'cancel']
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count:
        return {'label': 'positive', 'score': 0.6}
    elif neg_count > pos_count:
        return {'label': 'negative', 'score': 0.6}
    return {'label': 'neutral', 'score': 0.5}

def extract_categories(text):
    """Extract relevant categories from text"""
    text_lower = text.lower()
    categories = []
    
    if any(word in text_lower for word in ['bto', 'launch', 'ballot']):
        categories.append('new_development')
    if any(word in text_lower for word in ['price', 'cost', 'valuation', 'resale']):
        categories.append('price_analysis')
    if any(word in text_lower for word in ['mrt', 'lrt', 'transport', 'station']):
        categories.append('infrastructure')
    if any(word in text_lower for word in ['policy', 'regulation', 'rule', 'scheme']):
        categories.append('policy_change')
    if any(word in text_lower for word in ['market', 'trend', 'demand', 'supply']):
        categories.append('market_trend')
    
    return categories if categories else ['general']

def extract_locations(text):
    """Extract Singapore town names from text"""
    towns = [
        'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH', 'BUKIT PANJANG',
        'BUKIT TIMAH', 'CENTRAL', 'CHOA CHU KANG', 'CLEMENTI', 'GEYLANG', 'HOUGANG',
        'JURONG EAST', 'JURONG WEST', 'KALLANG', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
        'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES', 'TOA PAYOH',
        'WOODLANDS', 'YISHUN'
    ]
    
    found_locations = []
    text_upper = text.upper()
    
    for town in towns:
        if town in text_upper:
            found_locations.append(town)
    
    return found_locations if found_locations else ['NATIONWIDE']

def scrape_business_times(driver):
    """Scrape Business Times - HDB news"""
    print("\n📰 Scraping Business Times...")
    url = "https://www.businesstimes.com.sg/keywords/hdb"
    articles = []
    
    try:
        driver.get(url)
        time.sleep(3)
        
        # Find article elements
        article_elements = driver.find_elements(By.CSS_SELECTOR, "div.media-card, article.story-card")
        
        print(f"   Found {len(article_elements)} potential articles")
        
        for elem in article_elements[:15]:  # Limit to 15 most recent
            try:
                # Extract title
                title_elem = elem.find_element(By.CSS_SELECTOR, "h2.card-title, h3.card-title, a.headline")
                title = title_elem.text.strip()
                
                # Extract link
                link_elem = elem.find_element(By.CSS_SELECTOR, "a")
                link = link_elem.get_attribute('href')
                if not link.startswith('http'):
                    link = f"https://www.businesstimes.com.sg{link}"
                
                # Extract description
                try:
                    desc_elem = elem.find_element(By.CSS_SELECTOR, "p.card-text, div.description")
                    description = desc_elem.text.strip()
                except:
                    description = title
                
                # Filter: Only property-related
                if not is_property_related(title, description):
                    continue
                
                # Extract date
                try:
                    date_elem = elem.find_element(By.CSS_SELECTOR, "time, span.date")
                    date_text = date_elem.get_attribute('datetime') or date_elem.text
                    published_date = datetime.now().isoformat()  # Fallback
                except:
                    published_date = datetime.now().isoformat()
                
                article = {
                    'article_id': generate_article_id('Business Times', link, published_date),
                    'title': title,
                    'description': description,
                    'url': link,
                    'source': {
                        'name': 'Business Times',
                        'url': 'https://www.businesstimes.com.sg',
                        'type': 'news_media'
                    },
                    'published_at': published_date,
                    'scraped_at': datetime.now().isoformat(),
                    'locations': extract_locations(f"{title} {description}"),
                    'categories': extract_categories(f"{title} {description}"),
                    'sentiment': analyze_sentiment(f"{title} {description}"),
                    'impact_assessment': {
                        'predicted_impact': 'moderate_positive',
                        'affected_areas': extract_locations(f"{title} {description}"),
                        'timeframe': 'short_term'
                    },
                    'keywords': [w for w in REQUIRED_KEYWORDS if w in f"{title} {description}".lower()][:5],
                    'relevance_score': 0.9,
                    'view_count': 0,
                    'is_active': True
                }
                
                articles.append(article)
                print(f"   ✅ Added: {title[:60]}...")
                
            except Exception as e:
                continue
        
        print(f"   ✅ Business Times: {len(articles)} relevant articles")
        return articles
        
    except Exception as e:
        print(f"   ❌ Error scraping Business Times: {e}")
        return []

def scrape_straits_times(driver):
    """Scrape The Straits Times - HDB search"""
    print("\n📰 Scraping The Straits Times...")
    url = "https://www.straitstimes.com/search?searchkey=hdb&sort=relevancydate"
    articles = []
    
    try:
        driver.get(url)
        time.sleep(3)
        
        # Find article elements
        article_elements = driver.find_elements(By.CSS_SELECTOR, "div.card-list-item, article.story-card")
        
        print(f"   Found {len(article_elements)} potential articles")
        
        for elem in article_elements[:15]:
            try:
                # Extract title
                title_elem = elem.find_element(By.CSS_SELECTOR, "h3.card-headline, a.headline")
                title = title_elem.text.strip()
                
                # Extract link
                link_elem = elem.find_element(By.CSS_SELECTOR, "a")
                link = link_elem.get_attribute('href')
                if not link.startswith('http'):
                    link = f"https://www.straitstimes.com{link}"
                
                # Extract description
                try:
                    desc_elem = elem.find_element(By.CSS_SELECTOR, "p.card-description, div.description")
                    description = desc_elem.text.strip()
                except:
                    description = title
                
                # Filter: Only property-related
                if not is_property_related(title, description):
                    continue
                
                # Extract date
                try:
                    date_elem = elem.find_element(By.CSS_SELECTOR, "time, span.date")
                    published_date = date_elem.get_attribute('datetime') or datetime.now().isoformat()
                except:
                    published_date = datetime.now().isoformat()
                
                article = {
                    'article_id': generate_article_id('The Straits Times', link, published_date),
                    'title': title,
                    'description': description,
                    'url': link,
                    'source': {
                        'name': 'The Straits Times',
                        'url': 'https://www.straitstimes.com',
                        'type': 'news_media'
                    },
                    'published_at': published_date,
                    'scraped_at': datetime.now().isoformat(),
                    'locations': extract_locations(f"{title} {description}"),
                    'categories': extract_categories(f"{title} {description}"),
                    'sentiment': analyze_sentiment(f"{title} {description}"),
                    'impact_assessment': {
                        'predicted_impact': 'moderate_positive',
                        'affected_areas': extract_locations(f"{title} {description}"),
                        'timeframe': 'short_term'
                    },
                    'keywords': [w for w in REQUIRED_KEYWORDS if w in f"{title} {description}".lower()][:5],
                    'relevance_score': 0.9,
                    'view_count': 0,
                    'is_active': True
                }
                
                articles.append(article)
                print(f"   ✅ Added: {title[:60]}...")
                
            except Exception as e:
                continue
        
        print(f"   ✅ Straits Times: {len(articles)} relevant articles")
        return articles
        
    except Exception as e:
        print(f"   ❌ Error scraping Straits Times: {e}")
        return []

def scrape_cna(driver):
    """Scrape CNA - HDB topic"""
    print("\n📰 Scraping Channel NewsAsia...")
    url = "https://www.channelnewsasia.com/topic/hdb"
    articles = []
    
    try:
        driver.get(url)
        time.sleep(3)
        
        # Scroll to load more
        driver.execute_script("window.scrollTo(0, 1500);")
        time.sleep(2)
        
        # Find article elements
        article_elements = driver.find_elements(By.CSS_SELECTOR, "div.list-object, article.teaser")
        
        print(f"   Found {len(article_elements)} potential articles")
        
        for elem in article_elements[:15]:
            try:
                # Extract title
                title_elem = elem.find_element(By.CSS_SELECTOR, "h3, h6, a.title")
                title = title_elem.text.strip()
                
                # Extract link
                link_elem = elem.find_element(By.CSS_SELECTOR, "a")
                link = link_elem.get_attribute('href')
                if not link.startswith('http'):
                    link = f"https://www.channelnewsasia.com{link}"
                
                # Extract description
                try:
                    desc_elem = elem.find_element(By.CSS_SELECTOR, "p.description, div.teaser__description")
                    description = desc_elem.text.strip()
                except:
                    description = title
                
                # Filter: Only property-related
                if not is_property_related(title, description):
                    continue
                
                # Extract date
                try:
                    date_elem = elem.find_element(By.CSS_SELECTOR, "time, span.date")
                    published_date = date_elem.get_attribute('datetime') or datetime.now().isoformat()
                except:
                    published_date = datetime.now().isoformat()
                
                article = {
                    'article_id': generate_article_id('CNA', link, published_date),
                    'title': title,
                    'description': description,
                    'url': link,
                    'source': {
                        'name': 'CNA',
                        'url': 'https://www.channelnewsasia.com',
                        'type': 'news_media'
                    },
                    'published_at': published_date,
                    'scraped_at': datetime.now().isoformat(),
                    'locations': extract_locations(f"{title} {description}"),
                    'categories': extract_categories(f"{title} {description}"),
                    'sentiment': analyze_sentiment(f"{title} {description}"),
                    'impact_assessment': {
                        'predicted_impact': 'moderate_positive',
                        'affected_areas': extract_locations(f"{title} {description}"),
                        'timeframe': 'short_term'
                    },
                    'keywords': [w for w in REQUIRED_KEYWORDS if w in f"{title} {description}".lower()][:5],
                    'relevance_score': 0.9,
                    'view_count': 0,
                    'is_active': True
                }
                
                articles.append(article)
                print(f"   ✅ Added: {title[:60]}...")
                
            except Exception as e:
                continue
        
        print(f"   ✅ CNA: {len(articles)} relevant articles")
        return articles
        
    except Exception as e:
        print(f"   ❌ Error scraping CNA: {e}")
        return []

def scrape_propertyguru(driver):
    """Scrape PropertyGuru Singapore News"""
    print("\n📰 Scraping PropertyGuru...")
    url = "https://www.propertyguru.com.sg/property-management-news"
    articles = []
    
    try:
        driver.get(url)
        time.sleep(3)
        
        # Find article elements
        article_elements = driver.find_elements(By.CSS_SELECTOR, "article.news-card, div.article-item")
        
        print(f"   Found {len(article_elements)} potential articles")
        
        for elem in article_elements[:10]:
            try:
                title_elem = elem.find_element(By.CSS_SELECTOR, "h2, h3, a.title")
                title = title_elem.text.strip()
                
                link_elem = elem.find_element(By.CSS_SELECTOR, "a")
                link = link_elem.get_attribute('href')
                
                try:
                    desc_elem = elem.find_element(By.CSS_SELECTOR, "p, div.description")
                    description = desc_elem.text.strip()
                except:
                    description = title
                
                if not is_property_related(title, description):
                    continue
                
                article = {
                    'article_id': generate_article_id('PropertyGuru', link, datetime.now().isoformat()),
                    'title': title,
                    'description': description,
                    'url': link,
                    'source': {
                        'name': 'PropertyGuru',
                        'url': 'https://www.propertyguru.com.sg',
                        'type': 'property_portal'
                    },
                    'published_at': datetime.now().isoformat(),
                    'scraped_at': datetime.now().isoformat(),
                    'locations': extract_locations(f"{title} {description}"),
                    'categories': extract_categories(f"{title} {description}"),
                    'sentiment': analyze_sentiment(f"{title} {description}"),
                    'impact_assessment': {
                        'predicted_impact': 'moderate_positive',
                        'affected_areas': extract_locations(f"{title} {description}"),
                        'timeframe': 'short_term'
                    },
                    'keywords': [w for w in REQUIRED_KEYWORDS if w in f"{title} {description}".lower()][:5],
                    'relevance_score': 0.95,
                    'view_count': 0,
                    'is_active': True
                }
                
                articles.append(article)
                print(f"   ✅ Added: {title[:60]}...")
                
            except Exception as e:
                continue
        
        print(f"   ✅ PropertyGuru: {len(articles)} relevant articles")
        return articles
        
    except Exception as e:
        print(f"   ❌ Error scraping PropertyGuru: {e}")
        return []

def save_to_mongodb(articles):
    """Save articles to MongoDB"""
    if not articles:
        print("\n⚠️  No articles to save")
        return
    
    try:
        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB_NAME]
        collection = db['newsarticles']
        
        # Insert or update
        inserted = 0
        updated = 0
        
        for article in articles:
            result = collection.update_one(
                {'article_id': article['article_id']},
                {'$set': article},
                upsert=True
            )
            
            if result.upserted_id:
                inserted += 1
            else:
                updated += 1
        
        print(f"\n✅ Saved to MongoDB:")
        print(f"   📝 Inserted: {inserted}")
        print(f"   🔄 Updated: {updated}")
        print(f"   📊 Total: {len(articles)}")
        
        client.close()
        
    except Exception as e:
        print(f"\n❌ Error saving to MongoDB: {e}")

def main():
    """Main scraper function"""
    print("=" * 70)
    print("🏠 HIGH-QUALITY PROPERTY NEWS SCRAPER")
    print("=" * 70)
    print("\n✅ Sources:")
    print("   1. Business Times (HDB)")
    print("   2. The Straits Times (HDB)")
    print("   3. Channel NewsAsia (HDB)")
    print("   4. PropertyGuru")
    print("\n🎯 Filtering:")
    print("   ✅ ONLY property/housing-related content")
    print("   ❌ NO bus operations, awards, general transport")
    print("\n" + "=" * 70)
    
    driver = None
    all_articles = []
    
    try:
        driver = setup_driver()
        
        # Scrape all sources
        all_articles.extend(scrape_business_times(driver))
        time.sleep(2)
        
        all_articles.extend(scrape_straits_times(driver))
        time.sleep(2)
        
        all_articles.extend(scrape_cna(driver))
        time.sleep(2)
        
        all_articles.extend(scrape_propertyguru(driver))
        
        # Save to MongoDB
        save_to_mongodb(all_articles)
        
        print("\n" + "=" * 70)
        print("🎉 SCRAPING COMPLETE!")
        print("=" * 70)
        print(f"\n📊 Summary:")
        print(f"   Total Articles: {len(all_articles)}")
        print(f"   All property-related: ✅")
        print(f"   Filtered out irrelevant: ✅")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    finally:
        if driver:
            driver.quit()

if __name__ == "__main__":
    main()