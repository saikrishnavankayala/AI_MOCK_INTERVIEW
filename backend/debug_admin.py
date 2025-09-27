#!/usr/bin/env python3
"""
Debug script to check admin authentication
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import *
from werkzeug.security import check_password_hash

def debug_admin_auth():
    print("🔍 Debugging Admin Authentication")
    print("=" * 40)
    
    # Initialize database
    init_db()
    
    # Check if admin user exists
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, password_hash, role, is_verified FROM users WHERE email = ?", 
                      ("saikrishnavankayala9@gmail.com",))
        user_data = cursor.fetchone()
        
        if not user_data:
            print("❌ Admin user not found in database!")
            return False
        
        user_id, username, email, password_hash, role, is_verified = user_data
        print(f"✅ Admin user found:")
        print(f"   ID: {user_id}")
        print(f"   Username: {username}")
        print(f"   Email: {email}")
        print(f"   Role: {role}")
        print(f"   Verified: {is_verified}")
        print(f"   Password hash (first 20 chars): {password_hash[:20]}...")
        
        # Test password verification
        test_password = "Leela@2005"
        print(f"\n🔐 Testing password verification...")
        print(f"   Test password: {test_password}")
        
        is_valid = check_password_hash(password_hash, test_password)
        print(f"   Password valid: {is_valid}")
        
        if not is_valid:
            print("❌ Password verification failed!")
            print("   This means the stored hash doesn't match the password")
            return False
        
        if is_verified != 1:
            print("❌ User is not verified!")
            return False
        
        if role != 'admin':
            print("❌ User doesn't have admin role!")
            return False
        
        print("✅ All checks passed! Admin authentication should work.")
        
        # Test the authenticate_user function directly
        print(f"\n🧪 Testing authenticate_user function...")
        result = authenticate_user("saikrishnavankayala9@gmail.com", "Leela@2005")
        if result:
            print("✅ authenticate_user() works correctly!")
            print(f"   Returned: {result}")
        else:
            print("❌ authenticate_user() returned None!")
            
        return True

if __name__ == "__main__":
    debug_admin_auth()
