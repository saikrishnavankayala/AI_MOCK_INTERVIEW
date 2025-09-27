import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, BarChart3, Target, ArrowRight, Home, TrendingUp, Smile, Mic, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../config/api';
import { toast } from 'react-hot-toast';

interface ResultsData {
  totalQuestions: number;
  averageScore: number;
  performanceCategory: string;
  strengths: string[];
  improvements: string[];
  confidence: number;
  communication: number;
  facialExpressions: number;
  previousScore?: number;
  attempts?: AttemptData[];
}

interface AttemptData {
  id: number;
  question: string;
  answer: string;
  feedback_text: string;
  overall_score: number;
  timestamp: string;
  role: string;
  company: string;
  question_index?: number;
  total_questions?: number;
  interview_session_id?: string;
}

const InterviewResults: React.FC = () => {
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<number | null>(null);
  const [sessionComplete, setSessionComplete] = useState(true);
  const [currentSessionAttempts, setCurrentSessionAttempts] = useState<AttemptData[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Fetch results data
    const fetchResults = async () => {
      try {
        // Get the latest attempt data
        const attemptsResponse = await api.get('/api/attempts');
        const attempts = attemptsResponse.data.attempts || [];
        
        if (attempts.length === 0) {
          toast.error('No interview data found');
          navigate('/dashboard');
          return;
        }
        
        // Check if we have a specific session ID from navigation state or localStorage
        let sessionId = location.state?.sessionId;
        if (!sessionId) {
          const interviewCompleted = localStorage.getItem('interviewCompleted');
          if (interviewCompleted) {
            const completedData = JSON.parse(interviewCompleted);
            sessionId = completedData.sessionId;
          }
        }
        
        // Filter attempts by session ID if available, otherwise use recent attempts
        let currentSessionAttempts: AttemptData[];
        if (sessionId) {
          currentSessionAttempts = attempts.filter((attempt: AttemptData) => 
            attempt.interview_session_id === sessionId
          );
        } else {
          // Fallback: group by recent timestamp (within last hour)
          const latestAttempt = attempts[0];
          currentSessionAttempts = attempts.filter((attempt: AttemptData) => {
            const attemptTime = new Date(attempt.timestamp).getTime();
            const latestTime = new Date(latestAttempt.timestamp).getTime();
            return Math.abs(attemptTime - latestTime) < 3600000; // Within 1 hour
          });
        }
        
        // Sort by question index to maintain order
        currentSessionAttempts.sort((a, b) => (a.question_index || 1) - (b.question_index || 1));
        
        if (currentSessionAttempts.length === 0) {
          toast.error('No interview session data found');
          navigate('/dashboard');
          return;
        }
        
        // Store current session attempts in state
        setCurrentSessionAttempts(currentSessionAttempts);
        
        // Get performance summary for comparison - check if session is complete
        let performanceData = null;
        let isSessionComplete = true;
        
        if (sessionId) {
          try {
            const sessionResponse = await api.get(`/api/session-score/${sessionId}`);
            performanceData = sessionResponse.data;
            isSessionComplete = performanceData.is_complete !== false;
          } catch (error) {
            console.log('Session score not available, using fallback');
          }
        }
        
        if (!performanceData) {
          const performanceResponse = await api.get('/api/performance-summary');
          performanceData = performanceResponse.data;
        }
        
        // Update session completion state
        setSessionComplete(isSessionComplete);
        
        // Parse feedback to extract strengths and improvements from all attempts
        const allStrengths: string[] = [];
        const allImprovements: string[] = [];
        
        // Calculate average scores across all questions in the current session
        let totalConfidence = 0;
        let totalCommunication = 0;
        let totalFacialExpressions = 0;
        let totalScores = 0;
        let validMetricsCount = 0;
        
        currentSessionAttempts.forEach((attempt: AttemptData) => {
          // Extract feedback points from each attempt
          const feedbackLines = attempt.feedback_text.split('\n');
          let inStrengths = false;
          let inImprovements = false;
          
          feedbackLines.forEach((line: string) => {
            // Check for section headers
            if (line.includes('Communication Skills') || line.includes('Strengths:')) {
              inStrengths = true;
              inImprovements = false;
            } else if (line.includes('Improvement Tips') || line.includes('Areas for Improvement:')) {
              inStrengths = false;
              inImprovements = true;
            } else if (line.includes('Overall Score') || line.includes('Suggested Answer')) {
              inStrengths = false;
              inImprovements = false;
            }
            
            // Extract points with more flexible formatting
            if (inStrengths && (line.trim().startsWith('*') || line.trim().startsWith('-'))) {
              const point = line.trim().replace(/^[\*\-]\s*/, '');
              if (point && !allStrengths.includes(point)) {
                allStrengths.push(point);
              }
            } else if (inImprovements && (line.trim().startsWith('*') || line.trim().startsWith('-'))) {
              const point = line.trim().replace(/^[\*\-]\s*/, '');
              if (point && !allImprovements.includes(point)) {
                allImprovements.push(point);
              }
            }
          });
          
          // Extract scores from each attempt's feedback
          const confMatch = attempt.feedback_text.match(/CONFIDENCE_SCORE:\s*(\d+)\/10/);
          const commMatch = attempt.feedback_text.match(/COMMUNICATION_SCORE:\s*(\d+)\/10/);
          const faceMatch = attempt.feedback_text.match(/FACIAL_EXPRESSION_SCORE:\s*(\d+)\/10/);
          
          if (confMatch && commMatch && faceMatch) {
            totalConfidence += parseInt(confMatch[1]);
            totalCommunication += parseInt(commMatch[1]);
            totalFacialExpressions += parseInt(faceMatch[1]);
            validMetricsCount++;
          }
          
          if (attempt.overall_score) {
            totalScores += attempt.overall_score;
          }
        });
        
        // If we couldn't extract strengths/improvements, provide defaults
        if (allStrengths.length === 0) {
          allStrengths.push('Clear communication', 'Relevant answers', 'Professional demeanor');
        }
        
        if (allImprovements.length === 0) {
          allImprovements.push('Add more specific examples', 'Structure answers better', 'Practice more complex scenarios');
        }
        
        // Calculate averages
        const avgConfidence = validMetricsCount > 0 ? Math.round(totalConfidence / validMetricsCount) : 6;
        const avgCommunication = validMetricsCount > 0 ? Math.round(totalCommunication / validMetricsCount) : 6;
        const avgFacialExpressions = validMetricsCount > 0 ? Math.round(totalFacialExpressions / validMetricsCount) : 6;
        const avgScore = currentSessionAttempts.length > 0 ? Math.round((totalScores / currentSessionAttempts.length) * 10) / 10 : 0;
        
        // Determine performance category based on average score
        let performanceCategory = 'Needs Improvement';
        if (avgScore >= 8) performanceCategory = 'Excellent';
        else if (avgScore >= 6) performanceCategory = 'Good';
        else if (avgScore >= 4) performanceCategory = 'Average';
        
        // Get previous score for comparison (from performance data)
        let previousScore = undefined;
        if (performanceData.total_attempts > 1) {
          // Get second most recent session average
          const otherAttempts = attempts.filter((attempt: AttemptData) => 
            attempt.interview_session_id !== sessionId
          );
          if (otherAttempts.length > 0) {
            const recentOtherAttempt = otherAttempts[0];
            previousScore = recentOtherAttempt.overall_score;
          }
        }
        
        // Set the results data with the calculated averages
        setResultsData({
          totalQuestions: currentSessionAttempts.length,
          averageScore: isSessionComplete ? avgScore : 0,
          performanceCategory: isSessionComplete ? performanceCategory : 'Incomplete Session',
          strengths: isSessionComplete ? allStrengths.slice(0, 5) : ['Complete all questions to see strengths'],
          improvements: isSessionComplete ? allImprovements.slice(0, 5) : ['Finish the interview to get improvement suggestions'],
          confidence: isSessionComplete ? avgConfidence : 0,
          communication: isSessionComplete ? avgCommunication : 0,
          facialExpressions: isSessionComplete ? avgFacialExpressions : 0,
          previousScore,
          attempts: currentSessionAttempts // Show all session attempts
        });
        
      } catch (error) {
        console.error('Error fetching results:', error);
        toast.error('Failed to load interview results');
      } finally {
        setLoading(false);
        // Animate results display after data is loaded
        setTimeout(() => {
          setShowResults(true);
        }, 1000);
      }
    };
    
    fetchResults();
    
    return () => {};
  }, [navigate, location.state]);

  // Fallback data if no results are available
  const fallbackResults = {
    totalQuestions: 0,
    averageScore: 0,
    performanceCategory: 'No Data',
    strengths: ['No data available'],
    improvements: ['Complete an interview to see feedback'],
    confidence: 5, // Default value to show some progress in the bar
    communication: 6, // Default value to show some progress in the bar
    facialExpressions: 7 // Default value to show some progress in the bar
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPerformanceColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'excellent': return 'bg-green-100 text-green-800';
      case 'good': return 'bg-blue-100 text-blue-800';
      case 'average': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {loading || !showResults ? (
          // Loading animation
          <div className="text-center py-16">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
              <BarChart3 className="text-white" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Processing Your Interview...</h2>
            <p className="text-gray-600">Our AI is analyzing your responses and generating feedback</p>
            <div className="flex items-center justify-center mt-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        ) : (
          // Results display
          <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-8">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy size={24} />
              </div>
              <h1 className="text-3xl font-bold mb-2">Interview Completed!</h1>
              <p className="text-blue-100">Great job on completing your practice interview</p>
            </div>

            {/* Overall Score */}
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Overall Performance</h2>
              {sessionComplete ? (
                <>
                  <div className={`text-6xl font-bold mb-4 ${getScoreColor((resultsData || fallbackResults).averageScore)}`}>
                    {(resultsData || fallbackResults).averageScore}/10
                  </div>
                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${getPerformanceColor((resultsData || fallbackResults).performanceCategory)}`}>
                    {(resultsData || fallbackResults).performanceCategory} Performance
                  </div>
                </>
              ) : (
                <>
                  <div className="text-4xl font-bold mb-4 text-orange-600">
                    Session Incomplete
                  </div>
                  <div className="inline-block px-4 py-2 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                    Complete all questions for evaluation
                  </div>
                  <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Network Issue Detected:</strong> Your interview session was interrupted. 
                      Complete all {(resultsData || fallbackResults).totalQuestions} questions to receive your performance evaluation.
                    </p>
                  </div>
                </>
              )}
              {resultsData?.previousScore !== undefined && (
                <div className="mt-3">
                  <span className="text-gray-700 font-medium">Previous: </span>
                  <span className={getScoreColor(resultsData.previousScore)}>{resultsData.previousScore}/10</span>
                  {resultsData.averageScore > resultsData.previousScore ? (
                    <span className="text-green-600 ml-2">↑ Improved!</span>
                  ) : resultsData.averageScore < resultsData.previousScore ? (
                    <span className="text-orange-600 ml-2">↓ Decreased</span>
                  ) : (
                    <span className="text-blue-600 ml-2">→ Same</span>
                  )}
                </div>
              )}
              {sessionComplete ? (
                <p className="text-gray-600 mt-4">
                  Based on {(resultsData || fallbackResults).totalQuestions} questions answered
                </p>
              ) : (
                <p className="text-gray-600 mt-4">
                  {currentSessionAttempts.length} of {currentSessionAttempts[0]?.total_questions || 5} questions completed
                </p>
              )}
            </div>
            
            {/* Performance Metrics */}
            {resultsData && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Confidence Score */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-blue-100 p-2 rounded-lg mr-3">
                        <TrendingUp className="text-blue-600" size={18} />
                      </div>
                      <h4 className="font-semibold">Confidence</h4>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full" 
                        style={{ width: `${resultsData.confidence * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-right text-sm font-medium">{resultsData.confidence}/10</p>
                  </div>
                  
                  {/* Communication Score */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-purple-100 p-2 rounded-lg mr-3">
                        <Mic className="text-purple-600" size={18} />
                      </div>
                      <h4 className="font-semibold">Communication</h4>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div 
                        className="bg-purple-600 h-2.5 rounded-full" 
                        style={{ width: `${resultsData.communication * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-right text-sm font-medium">{resultsData.communication}/10</p>
                  </div>
                  
                  {/* Facial Expressions Score */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="bg-green-100 p-2 rounded-lg mr-3">
                        <Smile className="text-green-600" size={18} />
                      </div>
                      <h4 className="font-semibold">Facial Expressions</h4>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${resultsData.facialExpressions * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-right text-sm font-medium">{resultsData.facialExpressions}/10</p>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Feedback */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <Target className="text-green-600" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 ml-3">Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {(resultsData || fallbackResults).strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <div className="bg-green-500 w-2 h-2 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <BarChart3 className="text-orange-600" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 ml-3">Areas to Improve</h3>
                </div>
                <ul className="space-y-3">
                  {(resultsData || fallbackResults).improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start">
                      <div className="bg-orange-500 w-2 h-2 rounded-full mt-2 mr-3"></div>
                      <span className="text-gray-700">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">What's Next?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/interview-setup')}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
                >
                  <Target size={16} />
                  <span>New Interview</span>
                </button>
                
                <button
                  onClick={() => navigate('/history')}
                  className="flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all"
                >
                  <BarChart3 size={16} />
                  <span>View History</span>
                </button>
                
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center justify-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all"
                >
                  <Home size={16} />
                  <span>Dashboard</span>
                </button>
              </div>
            </div>

            {/* Detailed Question Feedback */}
            {resultsData?.attempts && resultsData.attempts.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Detailed Question Feedback</h3>
                <div className="space-y-4">
                  {resultsData.attempts.map((attempt, index) => (
                    <div key={attempt.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                        onClick={() => setExpandedAttempt(expandedAttempt === attempt.id ? null : attempt.id)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <MessageSquare className="text-blue-600" size={18} />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                            <p className="text-sm text-gray-600 line-clamp-1">{attempt.question}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreColor(attempt.overall_score)} bg-opacity-20`}>
                            Score: {attempt.overall_score}/10
                          </div>
                          {expandedAttempt === attempt.id ? 
                            <ChevronUp size={18} className="text-gray-500" /> : 
                            <ChevronDown size={18} className="text-gray-500" />}
                        </div>
                      </div>
                      
                      {expandedAttempt === attempt.id && (
                        <div className="p-4 bg-white border-t border-gray-200">
                          <div className="mb-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Your Answer:</h5>
                            <p className="text-gray-600 bg-gray-50 p-3 rounded-md text-sm">{attempt.answer}</p>
                          </div>
                          
                          <div className="mb-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Feedback:</h5>
                            <div className="bg-gray-50 p-4 rounded-md">
                              {attempt.feedback_text.includes('## Verbal Analysis') ? (
                                <div>
                                  {attempt.feedback_text.split('## ').map((section, sectionIndex) => {
                                    if (!section.trim()) return null;
                                    
                                    const [title, ...content] = section.split('\n');
                                    const sectionContent = content.join('\n');
                                    
                                    return (
                                      <div key={sectionIndex} className="mb-4 last:mb-0">
                                        <h6 className={`font-semibold mb-2 ${title.includes('Verbal') ? 'text-blue-700' : 'text-green-700'}`}>
                                          {title}
                                        </h6>
                                        <div className="text-sm">
                                          {sectionContent.split('\n').map((line, lineIndex) => {
                                            if (line.includes('OVERALL SCORE:')) {
                                              return (
                                                <div key={lineIndex} className="font-bold text-base my-2">
                                                  {line}
                                                </div>
                                              );
                                            } else if (line.includes('**') && !line.includes('Suggested Answer')) {
                                              return (
                                                <div key={lineIndex} className="font-medium my-2">
                                                  {line.replace(/\*\*/g, '')}
                                                </div>
                                              );
                                            } else if (line.includes('Suggested Answer')) {
                                              return (
                                                <div key={lineIndex} className="mt-3">
                                                  <div className="font-medium text-gray-800">{line.replace(/\*\*/g, '')}</div>
                                                </div>
                                              );
                                            } else if (line.trim().startsWith('*')) {
                                              return (
                                                <div key={lineIndex} className="flex items-start my-1">
                                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 mt-1.5 mr-2"></div>
                                                  <div>{line.replace(/^\*\s*/, '')}</div>
                                                </div>
                                              );
                                            } else {
                                              return line.trim() ? <p key={lineIndex} className="my-1">{line}</p> : null;
                                            }
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-600">{attempt.feedback_text}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tips for Next Time */}
            <div className="bg-gradient-to-r from-purple-100 to-blue-100 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-3">💡 Tips for Your Next Interview</h3>
              <ul className="text-gray-700 space-y-2 text-sm">
                <li>• Practice the STAR method (Situation, Task, Action, Result) for behavioral questions</li>
                <li>• Research the company thoroughly before your actual interview</li>
                <li>• Prepare specific examples that demonstrate your key skills</li>
                <li>• Practice your answers out loud to improve fluency</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InterviewResults;