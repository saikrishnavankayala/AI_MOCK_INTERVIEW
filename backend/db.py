import sqlite3
import os
import secrets
import re
import uuid
from datetime import datetime, timedelta
from contextlib import contextmanager
import threading

DB_NAME = "interview_app.db"

# Connection pool for better performance
class ConnectionPool:
    def __init__(self, max_connections=10):
        self._connections = []
        self._max_connections = max_connections
        self._lock = threading.Lock()
    
    def get_connection(self):
        with self._lock:
            if self._connections:
                return self._connections.pop()
            return sqlite3.connect(DB_NAME, timeout=30, check_same_thread=False)
    
    def return_connection(self, conn):
        with self._lock:
            if len(self._connections) < self._max_connections:
                self._connections.append(conn)
            else:
                conn.close()

pool = ConnectionPool()

@contextmanager
def get_db_connection():
    conn = pool.get_connection()
    try:
        yield conn
    finally:
        pool.return_connection(conn)

def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
                is_verified INTEGER DEFAULT 0, otp_code TEXT,
                otp_expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                role TEXT DEFAULT 'user'
            )''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL,
                user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
                role TEXT NOT NULL, company TEXT NOT NULL, question TEXT NOT NULL,
                answer TEXT NOT NULL, feedback_text TEXT NOT NULL, overall_score REAL DEFAULT 0,
                question_index INTEGER DEFAULT 1, total_questions INTEGER DEFAULT 5,
                interview_session_id TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )''')
        
        # Add new columns to existing attempts table if they don't exist
        try:
            cursor.execute('ALTER TABLE attempts ADD COLUMN question_index INTEGER DEFAULT 1')
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        try:
            cursor.execute('ALTER TABLE attempts ADD COLUMN total_questions INTEGER DEFAULT 5')
        except sqlite3.OperationalError:
            pass  # Column already exists
            
        try:
            cursor.execute('ALTER TABLE attempts ADD COLUMN interview_session_id TEXT')
        except sqlite3.OperationalError:
            pass  # Column already exists
            
        # Add role column to existing users table if it doesn't exist
        try:
            cursor.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"')
        except sqlite3.OperationalError:
            pass  # Column already exists
        
        conn.commit()
    print("✅ Database initialized successfully.")

def store_otp(email, otp):
    expires_at = datetime.now() + timedelta(minutes=10)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE email = ?", (otp, expires_at, email))
        conn.commit()

def verify_otp_and_activate(email, otp):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT otp_code, otp_expires_at FROM users WHERE email = ?", (email,))
        user_otp_data = cursor.fetchone()
        if not user_otp_data:
            return False, "User not found."
        stored_otp, expires_at_str = user_otp_data
        if not expires_at_str:
            return False, "No OTP found for this user."
        expires_at = datetime.strptime(expires_at_str, '%Y-%m-%d %H:%M:%S.%f')
        if stored_otp == otp and datetime.now() < expires_at:
            cursor.execute("UPDATE users SET is_verified = 1, otp_code = NULL, otp_expires_at = NULL WHERE email = ?", (email,))
            conn.commit()
            return True, "Account verified successfully."
        elif stored_otp != otp:
            return False, "Invalid OTP."
        else:
            return False, "OTP has expired."

def update_password(email, new_password_hash):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password_hash = ? WHERE email = ?", (new_password_hash, email))
        conn.commit()

def authenticate_user(email, password):
    """Authenticate user with email and password"""
    from werkzeug.security import check_password_hash
    print(f"🔍 DB: Authenticating user {email}")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, email, password_hash, role, is_verified FROM users WHERE email = ?", (email,))
        user_data = cursor.fetchone()
        
        print(f"🔍 DB: Query result: {user_data}")
        
        if not user_data:
            print("❌ DB: No user found with this email")
            return None
        
        user_id, username, user_email, stored_hash, role, is_verified = user_data
        
        print(f"🔍 DB: User found - ID: {user_id}, Role: {role}, Verified: {is_verified}")
        print(f"🔍 DB: Password hash (first 20 chars): {stored_hash[:20] if stored_hash else 'None'}...")
        
        if is_verified != 1:
            print("❌ DB: User is not verified")
            return None
        
        # Use Werkzeug's password verification to match the hashing method
        password_valid = check_password_hash(stored_hash, password)
        print(f"🔍 DB: Password validation result: {password_valid}")
        
        if password_valid:
            result = {
                "id": user_id,
                "username": username,
                "email": user_email,
                "role": role or "user"
            }
            print(f"✅ DB: Authentication successful, returning: {result}")
            return result
        else:
            print("❌ DB: Password validation failed")
            return None

def generate_token(user_id):
    """Generate a new session token for user"""
    return create_session(user_id)

def create_session(user_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        token = secrets.token_hex(24)
        cursor.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        conn.commit()
        return token

def get_user_from_token(token):
    if not token: return None
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT u.id, u.username, u.email, u.role FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = ?", (token,))
        user_data = cursor.fetchone()
        return {"id": user_data[0], "username": user_data[1], "email": user_data[2], "role": user_data[3] or "user"} if user_data else None

def create_admin_user(email, username, password_hash):
    """Create admin user with specified credentials"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO users (username, email, password_hash, is_verified, role) 
                VALUES (?, ?, ?, 1, 'admin')
            ''', (username, email, password_hash))
            conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            # User already exists, update to admin role
            cursor.execute('''
                UPDATE users SET role = 'admin', is_verified = 1 
                WHERE email = ?
            ''', (email,))
            conn.commit()
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            return cursor.fetchone()[0]

def is_admin_user(user_id):
    """Check if user has admin role"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT role FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        return result and result[0] == 'admin'

def save_attempt(user_id, role, company, question, answer, feedback_text, question_index=1, total_questions=5, interview_session_id=None):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        overall_score = parse_feedback_score(feedback_text)
        
        # Generate session ID if not provided
        if not interview_session_id:
            import uuid
            interview_session_id = str(uuid.uuid4())
        
        try:
            cursor.execute('''
                INSERT INTO attempts 
                (user_id, role, company, question, answer, feedback_text, overall_score, 
                 question_index, total_questions, interview_session_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, role, company, question, answer, feedback_text, overall_score, 
                  question_index, total_questions, interview_session_id))
            conn.commit()
            return interview_session_id
        except sqlite3.Error as e:
            print(f"❌ Database error in save_attempt: {e}")
            return None

def get_attempts_by_user(user_id, limit=None):
    with get_db_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if limit:
            cursor.execute('SELECT * FROM attempts WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?', (user_id, limit))
        else:
            cursor.execute('SELECT * FROM attempts WHERE user_id = ? ORDER BY timestamp DESC', (user_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_performance_summary(user_id):
    """
    Enhanced performance summary with proper mathematical scoring
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get all attempts with scores
        cursor.execute('''
            SELECT overall_score, interview_session_id, timestamp
            FROM attempts 
            WHERE user_id = ? AND overall_score > 0
            ORDER BY timestamp DESC
        ''', (user_id,))
        
        results = cursor.fetchall()
        
        if not results:
            return {
                "total_attempts": 0, 
                "total_questions_answered": 0,
                "total_interview_sessions": 0,
                "average_score_out_of_10": 0.0, 
                "performance_percentage": 0.0,
                "latest_session_score": 0.0,
                "score_trend": "No data"
            }
        
        # Calculate session-based scores (weighted average per session)
        session_scores = {}
        all_scores = []
        
        for score, session_id, timestamp in results:
            all_scores.append(score)
            if session_id:
                if session_id not in session_scores:
                    session_scores[session_id] = []
                session_scores[session_id].append(score)
        
        # Get total counts
        cursor.execute('''
            SELECT 
                COUNT(DISTINCT COALESCE(interview_session_id, 'single_' || id)) as session_count,
                COUNT(id) as total_attempts
            FROM attempts WHERE user_id = ?
        ''', (user_id,))
        
        count_result = cursor.fetchone()
        total_sessions = count_result[0] if count_result else 0
        total_attempts = count_result[1] if count_result else 0
        
        # Calculate weighted average: each session contributes equally
        if session_scores:
            session_averages = [sum(scores)/len(scores) for scores in session_scores.values()]
            overall_avg = sum(session_averages) / len(session_averages)
            
            # Get latest session score
            latest_session_id = results[0][1] if results[0][1] else None
            latest_session_score = (sum(session_scores.get(latest_session_id, [0])) / 
                                  len(session_scores.get(latest_session_id, [1]))) if latest_session_id else 0
            
            # Calculate trend (improvement/decline)
            if len(session_averages) >= 2:
                recent_avg = sum(session_averages[-2:]) / 2
                older_avg = sum(session_averages[:-2]) / len(session_averages[:-2]) if len(session_averages) > 2 else session_averages[0]
                trend = "Improving" if recent_avg > older_avg else "Declining" if recent_avg < older_avg else "Stable"
            else:
                trend = "Insufficient data"
        else:
            # Fallback to simple average if no sessions
            overall_avg = sum(all_scores) / len(all_scores) if all_scores else 0
            latest_session_score = all_scores[0] if all_scores else 0
            trend = "No sessions"
        
        performance_percentage = (overall_avg / 10) * 100 if overall_avg > 0 else 0
        
        return {
            "total_attempts": total_sessions, 
            "total_questions_answered": total_attempts,
            "total_interview_sessions": total_sessions,
            "average_score_out_of_10": round(overall_avg, 2), 
            "performance_percentage": round(performance_percentage, 2),
            "latest_session_score": round(latest_session_score, 2),
            "score_trend": trend
        }

def parse_feedback_score(feedback_text):
    """
    Enhanced score parsing that handles multiple score formats from AI feedback.
    Now properly validates scores and ensures genuine evaluation.
    """
    try:
        # First check if this is a zero-score feedback (invalid answer)
        if "**OVERALL SCORE: 0/10**" in feedback_text:
            return 0.0
        
        # Try to find OVERALL SCORE first (most reliable)
        overall_match = re.search(r"OVERALL SCORE:\s*(\d+\.?\d*)\s*/?\s*10", feedback_text, re.IGNORECASE)
        if overall_match:
            score = float(overall_match.group(1))
            # Validate score is within reasonable range
            return max(0.0, min(10.0, score))
        
        # Try to find any score pattern like "Score: X/10" or "X/10"
        score_match = re.search(r"(?:score|rating):\s*(\d+\.?\d*)\s*/?\s*10", feedback_text, re.IGNORECASE)
        if score_match:
            score = float(score_match.group(1))
            return max(0.0, min(10.0, score))
        
        # Try to find standalone score pattern "X/10"
        standalone_match = re.search(r"(\d+\.?\d*)\s*/\s*10", feedback_text)
        if standalone_match:
            score = float(standalone_match.group(1))
            return max(0.0, min(10.0, score))
        
        # Check for zero score reasons (invalid answers should get 0)
        zero_indicators = [
            "no answer was provided", "too brief", "insufficient detail",
            "filler words", "didn't answer", "no response", "zero score"
        ]
        
        feedback_lower = feedback_text.lower()
        for indicator in zero_indicators:
            if indicator in feedback_lower:
                return 0.0
        
        # If no score found and no zero indicators, this might be an error
        # Return 0 to be safe (genuine scoring principle)
        return 0.0
        
    except (TypeError, ValueError):
        return 0.0

def get_interview_session_attempts(user_id, session_id):
    """Get all attempts for a specific interview session"""
    with get_db_connection() as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM attempts 
            WHERE user_id = ? AND interview_session_id = ? 
            ORDER BY question_index ASC, timestamp ASC
        ''', (user_id, session_id))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_latest_interview_session(user_id):
    """Get the most recent interview session ID for a user"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT interview_session_id FROM attempts 
            WHERE user_id = ? AND interview_session_id IS NOT NULL 
            ORDER BY timestamp DESC LIMIT 1
        ''', (user_id,))
        result = cursor.fetchone()
        return result[0] if result else None

def is_session_complete(user_id, session_id):
    """
    Check if an interview session is complete (all questions answered).
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Get session info
        cursor.execute('''
            SELECT COUNT(*) as answered_count, MAX(total_questions) as total_questions
            FROM attempts 
            WHERE user_id = ? AND interview_session_id = ?
        ''', (user_id, session_id))
        
        result = cursor.fetchone()
        if not result or not result[1]:
            return False
            
        answered_count, total_questions = result
        return answered_count >= total_questions

def calculate_session_overall_score(user_id, session_id):
    """
    Calculate the overall score for a specific interview session using genuine evaluation.
    Only calculates if session is complete. Returns incomplete status otherwise.
    """
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check if session is complete first
        if not is_session_complete(user_id, session_id):
            cursor.execute('''
                SELECT COUNT(*) as answered_count, MAX(total_questions) as total_questions
                FROM attempts 
                WHERE user_id = ? AND interview_session_id = ?
            ''', (user_id, session_id))
            
            result = cursor.fetchone()
            answered_count = result[0] if result else 0
            total_questions = result[1] if result else 0
            
            return {
                "session_overall_score": None,
                "total_questions": total_questions,
                "answered_questions": answered_count,
                "valid_answers": 0,
                "score_breakdown": [],
                "performance_level": "Incomplete Session",
                "mathematical_details": f"Session incomplete: {answered_count}/{total_questions} questions answered",
                "is_complete": False
            }
        
        # Get ALL attempts for this session (including zero scores)
        cursor.execute('''
            SELECT overall_score, question_index, total_questions, answer, feedback_text
            FROM attempts 
            WHERE user_id = ? AND interview_session_id = ?
            ORDER BY question_index ASC
        ''', (user_id, session_id))
        
        all_results = cursor.fetchall()
        
        if not all_results:
            return {
                "session_overall_score": 0.0,
                "total_questions": 0,
                "answered_questions": 0,
                "valid_answers": 0,
                "score_breakdown": [],
                "performance_level": "No Data",
                "mathematical_details": "No attempts found for this session",
                "is_complete": False
            }
        
        # Separate valid answers (score > 0) from invalid ones (score = 0)
        valid_scores = []
        invalid_count = 0
        all_scores = []
        
        for row in all_results:
            score = float(row[0])
            all_scores.append(score)
            
            if score > 0:
                valid_scores.append(score)
            else:
                invalid_count += 1
        
        total_questions = all_results[0][2] if all_results else 5
        total_attempts = len(all_results)
        valid_answers = len(valid_scores)
        
        # Genuine scoring: Only consider meaningful answers
        if valid_answers == 0:
            session_score = 0.0
            performance_level = "No Valid Answers"
            mathematical_details = {
                "valid_answers": 0,
                "invalid_answers": invalid_count,
                "total_attempts": total_attempts,
                "formula": "No valid answers provided",
                "explanation": "All answers were too brief, unclear, or didn't address the questions"
            }
        else:
            # Calculate score based only on valid answers
            arithmetic_mean = sum(valid_scores) / len(valid_scores)
            
            # Penalty for incomplete sessions (unanswered questions count as 0)
            unanswered_questions = max(0, total_questions - total_attempts)
            total_possible_points = total_questions * 10  # Max 10 points per question
            actual_points = sum(valid_scores)  # Only count valid answers
            
            # Session score considers both quality and completeness
            session_score = (actual_points / total_possible_points) * 10
            
            # Performance level based on genuine evaluation
            if session_score >= 8.0 and valid_answers >= total_questions * 0.8:
                performance_level = "Excellent"
            elif session_score >= 6.5 and valid_answers >= total_questions * 0.6:
                performance_level = "Good"
            elif session_score >= 4.5 and valid_answers >= total_questions * 0.4:
                performance_level = "Average"
            elif session_score >= 2.5 or valid_answers >= total_questions * 0.2:
                performance_level = "Below Average"
            else:
                performance_level = "Needs Significant Improvement"
            
            mathematical_details = {
                "valid_answers": valid_answers,
                "invalid_answers": invalid_count,
                "unanswered_questions": unanswered_questions,
                "total_attempts": total_attempts,
                "average_of_valid_answers": round(arithmetic_mean, 2),
                "total_points_earned": round(actual_points, 2),
                "total_possible_points": total_possible_points,
                "formula": "Session Score = (Total Points Earned / Total Possible Points) × 10",
                "explanation": f"({actual_points:.1f} / {total_possible_points}) × 10 = {session_score:.2f}"
            }
        
        return {
            "session_overall_score": round(session_score, 2),
            "total_questions": total_questions,
            "answered_questions": total_attempts,
            "valid_answers": valid_answers,
            "invalid_answers": invalid_count,
            "score_breakdown": all_scores,
            "valid_score_breakdown": valid_scores,
            "performance_level": performance_level,
            "mathematical_details": mathematical_details,
            "is_complete": True
        }
