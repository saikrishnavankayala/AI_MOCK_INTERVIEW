# AI Mock Interview Platform

This project is a full-stack AI-powered Mock Interview platform. Once you upload your resume or select a Role/Company, the system generates questions using AI and provides feedback on your answers. It also supports video/audio recording, speech-to-text, and emotion analysis.

---

## 1) Project Overview

* A web app designed for interview practice.
* Personalized questions based on Resume/LinkedIn.
* AI feedback and scoring for answers.
* Video/audio recording with live transcription.
* Dashboard for past interview history and performance tracking.

Note: The current AI model is Groq’s `llama-3.1-8b-instant` (implemented in [backend/ai_engine.py] and [backend/feedback_engine.py]).

---

## 2) Key Features

* Resume-based or Role/Company-based question generation.
* Real-time video/audio recording (WebRTC).
* Live speech transcription (SpeechRecognition).
* Basic support for emotion analysis (DeepFace flow; currently mock response in [backend/app.py]).
* Authentication with JWT + OTP verification.
* AI feedback, scoring, and improvement suggestions.
* Interview session management with session score breakdown and history.

---

## 3) Tech Stack

* **Backend:** Flask, SQLite, Groq API, PyMuPDF, SpeechRecognition
* **Frontend:** React, TypeScript, Vite, React Router, Axios, Tailwind CSS
* **AI/ML:** Groq Chat Completions (`llama-3.1-8b-instant`), Web Speech API, (DeepFace base)

---

## 4) Folder Structure

```
ai-mock-interview/
├─ backend/                  # Flask API, AI engines, DB utils
│  ├─ app.py                 # Main Flask app, API routes
│  ├─ auth.py                # Register/Login/OTP/Password Reset
│  ├─ ai_engine.py           # Question generation (Groq)
│  ├─ feedback_engine.py     # Answer feedback/scoring (Groq)
│  ├─ db.py                  # SQLite DB, connection pool, schema & queries
│  ├─ resume_parser.py       # Resume PDF text extraction (PyMuPDF)
│  ├─ speech_to_text.py      # Audio to text (SpeechRecognition)
│  ├─ linkedin_scraper.py    # LinkedIn profile scraper (for future use)
│  ├─ templates/             # Templates like admin_dashboard.html
│  └─ uploads/               # Temporary file storage
│
├─ frontend/project/         # React + Vite + TS frontend
│  └─ package.json
│
├─ PROJECT_SETUP.md
├─ DEMO_INSTRUCTIONS.md
├─ PRESENTATION_DEMO.md
├─ PERFORMANCE_OPTIMIZATIONS.md
├─ requirements.txt
└─ README.md
```

---

## 5) Prerequisites

* Python 3.11+
* Node.js 18+
* npm or yarn

---

## 6) Setup Steps

### Backend Setup

1. Create a virtual environment (optional but recommended):

   ```bash
   python -m venv venv
   venv\Scripts\activate   # Windows
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Create `.env` file inside `backend/`:

   ```bash
   GROQ_API_KEY=your_groq_api_key_here
   JWT_SECRET_KEY=your_jwt_secret_key
   ```

4. Run backend:

   ```bash
   python backend/app.py
   ```

   Backend URL: [http://localhost:5000](http://localhost:5000)

### Frontend Setup

1. Install dependencies:

   ```bash
   cd frontend/project
   npm install
   ```

2. Create `.env` inside `frontend/project/`:

   ```bash
   VITE_API_URL=http://localhost:5000
   ```

3. Run frontend:

   ```bash
   npm run dev
   ```

   Frontend URL: [http://localhost:5173](http://localhost:5173)

---

## 7) Usage Flow

1. Register → Verify via email OTP.
2. Login → Token received (Authorization: Bearer <token>).
3. Upload Resume PDF or choose Role/Company.
4. Start Interview → Record video/audio, see live transcription.
5. AI feedback + scores for each answer.
6. Dashboard shows history & performance.

---

## 8) Key API Endpoints (Backend)

**Authentication (backend/auth.py):**

* `POST /api/register` – Register user & send OTP.
* `POST /api/verify-otp` – Verify OTP, return token + user info.
* `POST /api/login` – Login, return token + user info.
* `POST /api/forgot-password` – Send OTP for password reset.
* `POST /api/reset-password` – Reset password with OTP.

**Interview Core (backend/app.py):**

* `GET /` – Health check.
* `POST /api/upload-resume` – Upload PDF & extract text.
* `POST /api/generate-questions` – Generate 5 questions based on role/company/resume.
* `POST /api/generate-questions-from-linkedin` – Questions from LinkedIn activity.
* `POST /api/answer-feedback-text` – AI feedback + scores for answers.
* `POST /api/submit-video-answer` – Save attempt with video + transcription.
* `GET /api/attempts` – Fetch attempts (optional limit/session filter).
* `GET /api/performance-summary` – Performance summary (per session if `session_id`).
* `GET /api/latest-session` – Latest session details.
* `GET /api/session-score/<session_id>` – Session score breakdown.
* `POST /api/analyze-emotion` – Mock emotion analysis (currently neutral).

**Admin (role=admin):**

* `POST /api/admin/login` – Admin login.
* `GET /api/admin/dashboard` – System metrics.
* `GET /api/admin/metrics-report` – Evaluation report.
* `GET /api/admin/system-status` – Real-time status.

**Headers:**

* Use `Authorization: Bearer <token>` for protected routes.

---

## 9) Database Schema (SQLite) – [backend/db.py]

**Tables:**

* `users(id, username, email, password_hash, is_verified, otp_code, otp_expires_at, role)`
* `sessions(id, token, user_id, created_at)`
* `attempts(id, user_id, role, company, question, answer, feedback_text, overall_score, question_index, total_questions, interview_session_id, timestamp)`

**Highlights:**

* Connection Pool improves performance.
* Attempts linked via `interview_session_id`.
* Scores parsed via `parse_feedback_score()`.
* Overall session score calculated via `calculate_session_overall_score()`.

---

## 10) Security

* JWT-like session tokens with sessions table.
* OTP-based account verification & password reset.
* CORS enabled, file type verification (PDF).
* Input validation & error handling.

---

## 11) Performance Optimizations

See [PERFORMANCE_OPTIMIZATIONS.md]:

* DB Connection Pooling (60–80% overhead reduction).
* Optimized Queries with JOINs & aggregations.
* Login API now returns user data → fewer frontend calls.
* Attempts fetching with LIMIT for faster dashboard.
* Reduced frontend polling (30s → 2m).
* Results: Login <1s, Dashboard ~1–2s.

---

## 12) Demo Steps

* **Backend:**

  ```bash
  python backend/app.py
  ```

* **Frontend:**

  ```bash
  cd frontend/project
  npm run dev
  ```

* **Flow:**

  * Open [http://localhost:5173](http://localhost:5173) → Register (check console/email for OTP) → Login
  * Start new interview → Resume upload or Role/Company selection
  * Record 2–3 answers → Get AI feedback & scores
  * View dashboard & performance history

For detailed steps, see: [DEMO_INSTRUCTIONS.md], [PRESENTATION_DEMO.md]

---

## 13) Troubleshooting

* **Groq Error/No API Key:** Set `GROQ_API_KEY` in `backend/.env`.
* **PDF Parse Error:** Ensure file is valid PDF; short text may fail thresholds.
* **Audio Transcription Fail:** Poor audio or service issue (see `speech_to_text.py`).
* **CORS/Network Issues:** Set `VITE_API_URL=http://localhost:5000` in frontend `.env`.
* **Admin Access:** Ensure `users.role='admin'`. Use `admin_setup.py` or DB helper functions.

---

## 14) Notes

* AI Model: `llama-3.1-8b-instant` (Groq).
* Backend Port: 5000.
* Frontend Port: 5173 (Vite default).
* Video processing includes cleanup; can extend with DeepFace/FFmpeg.
* Quick setup also available in [PROJECT_SETUP.md].

---
