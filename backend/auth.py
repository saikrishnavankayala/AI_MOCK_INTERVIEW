# backend/auth.py

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import secrets
import db
from email_utils import send_otp_email
auth_bp = Blueprint("auth", __name__)

def generate_otp():
    """Generates a 6-digit OTP."""
    return str(secrets.randbelow(1_000_000)).zfill(6)

@auth_bp.route("/api/register", methods=["POST"])
def register_user():
    data = request.get_json()
    username, email, password = data.get("username"), data.get("email"), data.get("password")
    if not all([username, email, password]): return jsonify({"error": "All fields are required"}), 400
    password_hash, otp = generate_password_hash(password), generate_otp()
    try:
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", (username, email, password_hash))
            conn.commit()
        db.store_otp(email, otp)
        if send_otp_email(email, otp):
            return jsonify({"message": "Registration successful. Please check your email for an OTP."}), 201
        else:
            return jsonify({"error": "Registration successful, but failed to send verification email."}), 500
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username or email already exists"}), 409
    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500

@auth_bp.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    email, otp = data.get("email"), data.get("otp")
    if not email or not otp: return jsonify({"error": "Email and OTP are required"}), 400
    is_valid, message = db.verify_otp_and_activate(email, otp)
    if is_valid:
        with db.get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username FROM users WHERE email = ?", (email,))
            user_data = cursor.fetchone()
            user_id, username = user_data
        token = db.create_session(user_id)
        return jsonify({
            "message": message, 
            "token": token,
            "user": {"id": user_id, "email": email, "username": username}
        }), 200
    else:
        return jsonify({"error": message}), 400

@auth_bp.route("/api/login", methods=["POST"])
def login_user():
    data = request.get_json()
    email, password = data.get("email"), data.get("password")
    if not email or not password: return jsonify({"error": "Email and password are required"}), 400
    
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, password_hash, is_verified FROM users WHERE email = ?", (email,))
        user_record = cursor.fetchone()
    
    if not user_record: return jsonify({"error": "Invalid email or password"}), 401
    user_id, username, stored_hash, is_verified = user_record
    if not is_verified: return jsonify({"error": "Account not verified. Please check your email for an OTP."}), 403
    
    if check_password_hash(stored_hash, password):
        token = db.create_session(user_id)
        return jsonify({
            "message": "Login successful", 
            "token": token,
            "user": {"id": user_id, "email": email, "username": username}
        }), 200
    else:
        return jsonify({"error": "Invalid email or password"}), 401

# --- NEW ENDPOINT: FORGOT PASSWORD ---
@auth_bp.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Check if user exists
    with db.get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_exists = cursor.fetchone()

    if not user_exists:
        # Still return a success message to prevent email enumeration attacks
        return jsonify({"message": "If an account with that email exists, a password reset OTP has been sent."}), 200

    otp = generate_otp()
    db.store_otp(email, otp)
    
    if send_otp_email(email, otp):
        return jsonify({"message": "An OTP has been sent to your email to reset your password."}), 200
    else:
        return jsonify({"error": "Failed to send password reset email."}), 500

# --- NEW ENDPOINT: RESET PASSWORD ---
@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    email = data.get("email")
    otp = data.get("otp")
    new_password = data.get("new_password")

    if not all([email, otp, new_password]):
        return jsonify({"error": "Email, OTP, and new password are required"}), 400

    # We can reuse verify_otp_and_activate. It correctly checks the OTP and clears it.
    # The account is already verified, so setting is_verified=1 again is harmless.
    is_valid, message = db.verify_otp_and_activate(email, otp)

    if is_valid:
        new_password_hash = generate_password_hash(new_password)
        db.update_password(email, new_password_hash)
        return jsonify({"message": "Password has been reset successfully. You can now log in."}), 200
    else:
        return jsonify({"error": message}), 400
