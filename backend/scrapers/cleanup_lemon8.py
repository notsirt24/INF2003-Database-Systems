#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CLEANUP: Reset Lemon8 data for fresh processing
"""

import os
import sys
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Load environment
project_root = Path(__file__).parent.parent.parent
env_file = project_root / 'database' / 'scripts' / '.env'
if env_file.exists():
    load_dotenv(env_file)

MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'INF2006-Database_Systems')
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_DB_NAME]

print("\n" + "="*70)
print("[LEMON8 CLEANUP] Resetting data for fresh processing")
print("="*70)

# Count before
reviews_before = db['reviews'].count_documents({'source': 'lemon8'})
raw_before = db['lemon8_raw_posts'].count_documents({})

print(f"\n[BEFORE]")
print(f"   Reviews (lemon8): {reviews_before}")
print(f"   Raw posts: {raw_before}")
print(f"   Processed: {db['lemon8_raw_posts'].count_documents({'processed': True})}")

# Delete reviews
if reviews_before > 0:
    result = db['reviews'].delete_many({'source': 'lemon8'})
    print(f"\n[DELETED] {result.deleted_count} Lemon8 reviews")

# Reset raw posts
if raw_before > 0:
    result = db['lemon8_raw_posts'].update_many(
        {},
        {
            '$set': {'processed': False},
            '$unset': {'analyzed_at': '', 'error': ''}
        }
    )
    print(f"[RESET] {result.modified_count} raw posts to unprocessed")

# Clear dirty data
dirty_before = db['lemon8_dirty_data'].count_documents({})
if dirty_before > 0:
    result = db['lemon8_dirty_data'].delete_many({})
    print(f"[CLEARED] {result.deleted_count} dirty data records")

# Verify
print(f"\n[AFTER]")
print(f"   Reviews (lemon8): {db['reviews'].count_documents({'source': 'lemon8'})}")
print(f"   Raw posts: {db['lemon8_raw_posts'].count_documents({})}")
print(f"   Unprocessed: {db['lemon8_raw_posts'].count_documents({'processed': False})}")
print(f"   Dirty data: {db['lemon8_dirty_data'].count_documents({})}")

print("\n[Ready to run enhanced Phase 2]")
print("   Command: python backend/scrapers/lemonphase2_enhanced.py\n")
print("="*70 + "\n")

client.close()
