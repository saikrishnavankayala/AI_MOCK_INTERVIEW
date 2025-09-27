import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Play, Trophy, Clock, TrendingUp, Star } from 'lucide-react';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import api from '../config/api';
import { PerformanceSummary, InterviewAttempt } from '../types';
import toast from 'react-hot-toast';

const Dashboard: React.FC = () => {
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<InterviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    
    // Reduced refresh frequency to improve performance
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 120000); // 2 minutes instead of 30 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch performance data first (lighter query)
      const performanceRes = await api.get('/api/performance-summary');
      setPerformance(performanceRes.data);
      
      // Only fetch attempts if we need to show them
      if (performanceRes.data.total_attempts > 0) {
        const attemptsRes = await api.get('/api/attempts?limit=5'); // Limit to recent 5
        
        const attempts = Array.isArray(attemptsRes.data.attempts) 
          ? attemptsRes.data.attempts 
          : [];
        
        // Simplified processing for better performance
        const sessionMap = new Map();
        attempts.forEach((attempt: any) => {
          const sessionId = attempt.interview_session_id || `single_${attempt.id}`;
          if (!sessionMap.has(sessionId)) {
            sessionMap.set(sessionId, {
              ...attempt,
              questionsCount: 1,
              totalScore: attempt.overall_score || 0
            });
          } else {
            const session = sessionMap.get(sessionId);
            session.questionsCount += 1;
            session.totalScore += (attempt.overall_score || 0);
            if (new Date(attempt.timestamp) > new Date(session.timestamp)) {
              session.timestamp = attempt.timestamp;
            }
          }
        });
        
        const uniqueSessions = Array.from(sessionMap.values())
          .map(session => ({
            ...session,
            overall_score: Math.round((session.totalScore / session.questionsCount) * 10) / 10,
            question: `Interview Session (${session.questionsCount} questions)`
          }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5);
        
        setRecentAttempts(uniqueSessions);
      } else {
        setRecentAttempts([]);
      }
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceIcon = (percentage: number) => {
    if (percentage >= 80) return <Trophy className="text-yellow-500" size={24} />;
    if (percentage >= 60) return <TrendingUp className="text-green-500" size={24} />;
    return <Star className="text-blue-500" size={24} />;
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back!</h1>
          <p className="text-blue-100 mb-6">Ready to practice and improve your interview skills?</p>
          <button
            onClick={() => navigate('/interview-setup')}
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all inline-flex items-center space-x-2"
          >
            <Play size={20} />
            <span>Start New Interview</span>
          </button>
        </div>

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm">Total Attempts</p>
                <p className="text-3xl font-bold text-gray-900">{performance?.total_attempts || 0}</p>
              </div>
              <BarChart3 className="text-blue-500" size={32} />
            </div>
            <p className="text-gray-500 text-sm">Practice sessions completed</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm">Average Score</p>
                <p className={`text-3xl font-bold ${getScoreColor(performance?.average_score_out_of_10 || 0)}`}>
                  {performance?.average_score_out_of_10 || 0}/10
                </p>
              </div>
              <Clock className="text-green-500" size={32} />
            </div>
            <p className="text-gray-500 text-sm">Overall performance rating</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm">Performance</p>
                <p className={`text-3xl font-bold ${getScoreColor((performance?.performance_percentage || 0) / 10)}`}>
                  {Math.round(performance?.performance_percentage || 0)}%
                </p>
              </div>
              {getPerformanceIcon(performance?.performance_percentage || 0)}
            </div>
            <p className="text-gray-500 text-sm">Your improvement level</p>
          </div>
        </div>

        {/* Recent Attempts */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Recent Interviews</h2>
              <button
                onClick={() => navigate('/history')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {recentAttempts.length === 0 ? (
              <div className="text-center py-8">
                <Play className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-500">No interviews yet. Start your first practice session!</p>
                <button
                  onClick={() => navigate('/interview-setup')}
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all"
                >
                  Start Interview
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-semibold text-gray-900">{attempt.role}</h3>
                        <span className="text-gray-400">at</span>
                        <span className="text-blue-600 font-medium">{attempt.company}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {attempt.question && attempt.question.length > 100 
                          ? `${attempt.question.substring(0, 100)}...` 
                          : attempt.question || 'Interview session completed'
                        }
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(attempt.timestamp).toLocaleDateString()} at{' '}
                        {new Date(attempt.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getScoreColor(Number(attempt.overall_score) || 0)}`}>
                        {attempt.overall_score
                          ? attempt.overall_score.toString() || "N/A"
                          : "N/A"}/10
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;