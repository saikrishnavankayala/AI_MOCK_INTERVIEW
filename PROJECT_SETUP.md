# AI Mock Interview Platform - Setup Guide

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on: http://localhost:5000

### Frontend Setup
```bash
cd frontend/project
npm install
npm run dev
```
Frontend runs on: http://localhost:5173

## 🔧 Environment Configuration

### Backend (.env in backend folder)
```
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET_KEY=your_jwt_secret_key
```

### Frontend (.env in frontend/project folder)
```
VITE_API_URL=http://localhost:5000
```

## 📋 Features Implemented

✅ **Authentication System**
- JWT-based auth with OTP verification
- User registration and login

✅ **Interview Management**
- Resume-based question generation
- Role/company-specific questions
- Multi-question interview sessions

✅ **Real-time Recording**
- Video/audio recording with WebRTC
- Live speech transcription
- Facial expression analysis

✅ **AI Analysis**
- Groq API integration (Llama3-70B)
- DeepFace emotion detection
- Comprehensive feedback generation

✅ **Dashboard & Results**
- Performance tracking
- Interview history
- Session-based result aggregation

## 🛠 Tech Stack

**Backend:** Flask, SQLite, Groq AI, DeepFace, OpenCV
**Frontend:** React, TypeScript, Vite, Tailwind CSS
**AI/ML:** Groq API, DeepFace, Web Speech API

## 📱 Usage Flow

1. Register/Login → OTP Verification
2. Upload Resume OR Select Role/Company
3. Start Interview → Record Answers
4. Get AI Feedback → View Results
5. Track Progress on Dashboard

## 🔒 Security Features

- JWT token authentication
- File upload validation
- CORS protection
- Input sanitization

## 📊 Database Schema

- Users table with authentication
- Interview sessions with tracking
- Attempts with detailed feedback
- Performance analytics

## 🚀 Production Ready

- Error handling and retry logic
- Session management
- Real-time updates
- Responsive design
- Performance optimizations
