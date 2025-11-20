#!/usr/bin/env python3
"""
Diagnostic Script - Check .env File
Tests if MongoDB URI is readable
"""

import os
from dotenv import load_dotenv
from pathlib import Path

print("\n" + "="*70)
print("🔍 DIAGNOSTIC: Checking .env File")
print("="*70 + "\n")

# Find .env files
possible_paths = [
    '.env',
    '../.env',
    '../../database/scripts/.env',
    '../database/scripts/.env',
    Path(__file__).parent / '.env',
    Path(__file__).parent.parent / '.env',
]

print("📁 Searching for .env files:\n")

found_envs = []
for env_path in possible_paths:
    if os.path.exists(env_path):
        abs_path = os.path.abspath(env_path)
        print(f"   ✅ Found: {env_path}")
        print(f"      Full path: {abs_path}")
        found_envs.append(abs_path)
    else:
        print(f"   ❌ Not found: {env_path}")

if not found_envs:
    print("\n❌ No .env files found!")
    print("   Please create .env file with MongoDB credentials")
    exit(1)

print("\n" + "="*70)
print("📝 Testing Each .env File")
print("="*70 + "\n")

for env_file in found_envs:
    print(f"Testing: {env_file}\n")
    
    # Clear environment first
    if 'MONGODB_URI' in os.environ:
        del os.environ['MONGODB_URI']
    if 'MONGODB_DB_NAME' in os.environ:
        del os.environ['MONGODB_DB_NAME']
    
    # Load this .env
    load_dotenv(env_file, override=True)
    
    # Check what we got
    mongodb_uri = os.getenv('MONGODB_URI')
    mongodb_db = os.getenv('MONGODB_DB_NAME')
    
    print(f"   MONGODB_URI: ", end='')
    if mongodb_uri:
        # Hide password for security
        if '@' in mongodb_uri:
            parts = mongodb_uri.split('@')
            masked = parts[0].split(':')[0] + ':****@' + parts[1]
            print(f"✅ Set")
            print(f"   Value (masked): {masked}")
        else:
            print(f"✅ {mongodb_uri}")
    else:
        print("❌ NOT SET")
    
    print(f"   MONGODB_DB_NAME: ", end='')
    if mongodb_db:
        print(f"✅ {mongodb_db}")
    else:
        print("❌ NOT SET")
    
    print()

# Now read the actual file content
print("="*70)
print("📄 Raw .env File Content")
print("="*70 + "\n")

if found_envs:
    env_to_check = found_envs[0]
    print(f"Reading: {env_to_check}\n")
    
    try:
        with open(env_to_check, 'r') as f:
            lines = f.readlines()
            
        for i, line in enumerate(lines, 1):
            line = line.rstrip('\n')
            
            # Check for MongoDB lines
            if 'MONGODB' in line.upper():
                if line.strip().startswith('#'):
                    print(f"   Line {i}: {line} ⚠️  COMMENTED OUT!")
                elif '=' in line and line.split('=', 1)[1].strip():
                    print(f"   Line {i}: {line.split('=')[0]}=... ✅ HAS VALUE")
                elif '=' in line:
                    print(f"   Line {i}: {line} ❌ EMPTY VALUE!")
                else:
                    print(f"   Line {i}: {line}")
            elif line.strip() and not line.strip().startswith('#'):
                # Show other non-comment lines
                print(f"   Line {i}: {line.split('=')[0]}=...")
                
    except Exception as e:
        print(f"   ❌ Error reading file: {e}")

print("\n" + "="*70)
print("🧪 Testing MongoDB Connection")
print("="*70 + "\n")

# Try to connect
if 'MONGODB_URI' not in os.environ or not os.environ['MONGODB_URI']:
    print("❌ Cannot test connection - MONGODB_URI not set")
    print("\n💡 SOLUTION:")
    print("   1. Open .env file")
    print("   2. Check line with MONGODB_URI")
    print("   3. Make sure it's not commented out (no # at start)")
    print("   4. Make sure it has a value after =")
    print("\n   Example:")
    print("   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/")
else:
    print("Attempting connection...")
    
    try:
        from pymongo import MongoClient
        
        uri = os.environ['MONGODB_URI']
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        
        # Test connection
        client.server_info()
        
        print("   ✅ Connection successful!")
        
        # Show databases
        dbs = client.list_database_names()
        print(f"   📦 Available databases: {', '.join(dbs)}")
        
        # Check our database
        db_name = os.environ.get('MONGODB_DB_NAME', 'INF2006-Database_Systems')
        if db_name in dbs:
            print(f"   ✅ Database '{db_name}' exists")
            
            db = client[db_name]
            collections = db.list_collection_names()
            print(f"   📝 Collections: {', '.join(collections) if collections else 'None yet'}")
        else:
            print(f"   ⚠️  Database '{db_name}' doesn't exist yet (will be created on first write)")
        
        client.close()
        
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        print("\n💡 Check:")
        print("   1. MongoDB URI is correct")
        print("   2. Username and password are correct")
        print("   3. IP address is whitelisted in MongoDB Atlas")
        print("   4. Database name is correct")

print("\n" + "="*70)
print("✅ Diagnostic Complete")
print("="*70 + "\n")