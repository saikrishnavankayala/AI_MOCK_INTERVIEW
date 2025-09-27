#!/usr/bin/env python3
"""
Admin Setup Script for AI Mock Interview Platform
Creates the admin user with specified credentials for metrics dashboard access.
"""

import sys
import os
import hashlib
from werkzeug.security import generate_password_hash

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db import create_admin_user, init_db

def setup_admin():
    """Setup admin user with specified credentials"""
    
    # Admin credentials
    ADMIN_EMAIL = "saikrishnavankayala9@gmail.com"
    ADMIN_USERNAME = "admin_saikrishna"
    ADMIN_PASSWORD = "Leela@2005"
    
    print("🔧 Setting up Admin Dashboard...")
    print(f"📧 Admin Email: {ADMIN_EMAIL}")
    print(f"👤 Admin Username: {ADMIN_USERNAME}")
    
    try:
        # Initialize database first
        init_db()
        
        # Hash the password
        password_hash = generate_password_hash(ADMIN_PASSWORD)
        
        # Delete existing admin user first (if exists) and recreate
        from db import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE email = ?", (ADMIN_EMAIL,))
            conn.commit()
            print(f"🗑️ Removed existing user with email: {ADMIN_EMAIL}")
        
        # Create admin user
        admin_id = create_admin_user(ADMIN_EMAIL, ADMIN_USERNAME, password_hash)
        
        print(f"✅ Admin user created successfully!")
        print(f"🆔 Admin ID: {admin_id}")
        print(f"🔐 Password: {ADMIN_PASSWORD}")
        print("\n📊 Admin Dashboard Access:")
        print("- Login with the above credentials")
        print("- Access exclusive metrics endpoints")
        print("- View comprehensive system performance")
        print("- Perfect for professor demonstrations!")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up admin: {str(e)}")
        return False

if __name__ == "__main__":
    print("🚀 AI Mock Interview Platform - Admin Setup")
    print("=" * 50)
    
    success = setup_admin()
    
    if success:
        print("\n🎉 Admin setup completed successfully!")
        print("You can now login as admin to access the metrics dashboard.")
    else:
        print("\n💥 Admin setup failed. Please check the error messages above.")
