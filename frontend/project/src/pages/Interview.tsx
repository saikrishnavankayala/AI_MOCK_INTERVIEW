import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Upload, MessageSquare } from 'lucide-react';
import Layout from '../components/Layout';
import { api } from '../config/api';
import toast from 'react-hot-toast';

interface InterviewData {
  role: string;
  company: string;
  resumeText?: string;
  roundType: string;
}

interface Question {
  id: number;
  text: string;
}

const Interview: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 15));
  
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [transcribedText, setTranscribedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  useEffect(() => {
    const setupData = localStorage.getItem('interviewSetup');
    if (!setupData) {
      navigate('/interview-setup');
      return;
    }
    
    const data = JSON.parse(setupData);
    setInterviewData(data);
    
    // Generate questions first, then setup camera
    generateInterviewQuestions(data);
    
    // Add delay to ensure DOM is ready
    setTimeout(() => {
      setupMediaDevices();
    }, 1000);
    
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [navigate]);

  const setupMediaDevices = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }
      
      // Try to get available devices first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (videoDevices.length === 0) {
        throw new Error('No camera devices found');
      }
      
      if (audioDevices.length === 0) {
        throw new Error('No microphone devices found');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        
        // Wait for video to load and play
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not available'));
            return;
          }
          
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
              .then(() => {
                setLoading(false);
                toast.success('Camera ready!');
                resolve(true);
              })
              .catch((playError) => {
                reject(playError);
              });
          };
          
          videoRef.current.onerror = (error) => {
            reject(error);
          };
          
          // Timeout after 10 seconds
          setTimeout(() => {
            reject(new Error('Camera setup timeout'));
          }, 10000);
        });
      }
    } catch (error: any) {
      let errorMessage = 'Failed to access camera/microphone.';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No camera or microphone found. Please connect devices and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Camera is being used by another application. Please close other apps and try again.';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = 'Camera constraints not supported. Trying with basic settings...';
        
        // Retry with basic constraints
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
          });
          streamRef.current = basicStream;
          if (videoRef.current) {
            videoRef.current.srcObject = basicStream;
            videoRef.current.muted = true;
            await videoRef.current.play();
            setLoading(false);
            toast.success('Camera ready with basic settings!');
            return;
          }
        } catch (retryError) {
          // Silent retry failure
        }
      } else if (error.message === 'No camera devices found') {
        errorMessage = 'No camera detected. Please connect a camera and refresh the page.';
      } else if (error.message === 'No microphone devices found') {
        errorMessage = 'No microphone detected. Please connect a microphone and refresh the page.';
      }
      
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const generateInterviewQuestions = async (data: any) => {
    try {
      const response = await api.post('/api/generate-questions', {
        role: data.role,
        resume_text: data.resumeText,
        company: data.company,
        round_type: data.roundType
      });
      
      const questionList = response.data.questions.map((q: string, index: number) => {
        let cleanQuestion = q.trim();
        
        // Only remove simple numbering patterns, preserve everything else
        cleanQuestion = cleanQuestion.replace(/^\d+[.)]\s*/, '');
        
        // Remove "Question:" prefix only if it exists
        cleanQuestion = cleanQuestion.replace(/^Question\s*\d*[:.\s]*/i, '');
        
        // Ensure proper capitalization
        if (cleanQuestion.length > 0) {
          cleanQuestion = cleanQuestion.charAt(0).toUpperCase() + cleanQuestion.slice(1);
        }
        
        // Only add question mark if it doesn't end with punctuation
        if (cleanQuestion && !cleanQuestion.match(/[.?!]$/)) {
          cleanQuestion += '?';
        }
        
        return {
          id: index + 1,
          text: cleanQuestion
        };
      });
      
      setQuestions(questionList);
    } catch (error) {
      toast.error('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.maxAlternatives = 1;

    let accumulatedText = '';
    let restartTimeout: NodeJS.Timeout | null = null;

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          accumulatedText += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update transcribed text in real-time with reduced lag
      const fullText = (accumulatedText + interimTranscript).trim();
      setTranscribedText(fullText);
    };

    recognitionRef.current.onend = () => {
      // Clear any existing restart timeout
      if (restartTimeout) {
        clearTimeout(restartTimeout);
      }
      
      // Restart immediately if still recording to reduce lag
      if (isRecording) {
        restartTimeout = setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log('Speech recognition restart failed:', e);
            }
          }
        }, 50); // Reduced timeout for faster restart
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.log('Speech recognition error:', event.error);
      
      // Handle different error types more efficiently
      if (event.error === 'network') {
        // Network error - retry after short delay
        if (isRecording) {
          setTimeout(() => {
            if (isRecording) {
              startSpeechRecognition();
            }
          }, 500);
        }
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        // Other errors - retry with longer delay
        if (isRecording) {
          setTimeout(() => {
            if (isRecording) {
              startSpeechRecognition();
            }
          }, 1000);
        }
      }
    };

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.log('Failed to start speech recognition:', e);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (!streamRef.current) {
      toast.error('Camera not ready');
      return;
    }

    try {
      // Clear previous recording data and transcription
      setRecordedChunks([]);
      setTranscribedText(''); // Clear previous transcription when starting new recording
      
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }
      
      const recorder = new MediaRecorder(streamRef.current, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks(prev => {
            const newChunks = [...prev, event.data];
            return newChunks;
          });
        }
      };
      
      recorder.onerror = () => {
        toast.error('Recording error occurred');
      };
      
      recorder.start(1000); // Collect data every second
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      // Start speech recognition with a small delay to ensure recording is active
      setTimeout(() => {
        startSpeechRecognition();
      }, 100);
      
      toast.success('Recording started - speak clearly for best transcription');
    } catch (error) {
      console.error('Recording error:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      stopSpeechRecognition();
      
      // Clear transcribed text when stopping recording
      setTranscribedText('');
      
      toast.success('Recording stopped - transcription cleared');
    }
  };

  const skipQuestion = async () => {
    try {
      setSubmitting(true);
      
      // Submit a skipped answer
      const formData = new FormData();
      const emptyBlob = new Blob([], { type: 'video/webm' });
      formData.append('video', emptyBlob, 'skipped_answer.webm');
      formData.append('question', questions[currentQuestionIndex]?.text || 'Unknown question');
      formData.append('role', interviewData?.role || 'General');
      formData.append('company', interviewData?.company || 'General');
      formData.append('transcribed_text', 'Question skipped by user');
      formData.append('question_index', (currentQuestionIndex + 1).toString());
      formData.append('total_questions', questions.length.toString());
      formData.append('interview_session_id', sessionId.current);
      
      const response = await api.post('/api/submit-video-answer', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      if (response?.data) {
        toast.success('Question skipped successfully!');
        
        // Move to next question or complete interview
        const isLastQuestion = currentQuestionIndex >= questions.length - 1;
        
        if (isLastQuestion) {
          localStorage.removeItem('currentInterviewSession');
          navigate('/interview-results', { 
            state: { 
              completed: true,
              sessionId: sessionId.current,
              totalQuestions: questions.length
            } 
          });
        } else {
          const nextIndex = currentQuestionIndex + 1;
          
          setCurrentQuestionIndex(nextIndex);
          setRecordedChunks([]);
          setIsRecording(false);
          setTranscribedText('');
          setUploadProgress(0);
          
          toast.success(`Moving to question ${nextIndex + 1} of ${questions.length}`);
        }
      }
    } catch (error: any) {
      toast.error('Failed to skip question. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const submitAnswer = async () => {
    if (!mediaRecorder) {
      toast.error('Recording not available - please start recording first');
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    try {
      // Stop recording if active
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        
        await new Promise((resolve) => {
          const originalOnStop = mediaRecorder.onstop;
          mediaRecorder.onstop = (event) => {
            if (originalOnStop) originalOnStop.call(mediaRecorder, event);
            resolve(event);
          };
        });
      }

      // Wait for chunks to be processed
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (recordedChunks.length === 0) {
        toast.error('No video data captured. Please try recording again.');
        setSubmitting(false);
        setIsRecording(false);
        return;
      }

      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      
      const formData = new FormData();
      formData.append('video', videoBlob, 'interview_answer.webm');
      formData.append('question', questions[currentQuestionIndex]?.text || 'Unknown question');
      formData.append('role', interviewData?.role || 'General');
      formData.append('company', interviewData?.company || 'General');
      formData.append('transcribed_text', transcribedText || 'No transcription available');
      formData.append('question_index', (currentQuestionIndex + 1).toString());
      formData.append('total_questions', questions.length.toString());
      formData.append('interview_session_id', sessionId.current);
      
      const response = await api.post('/api/submit-video-answer', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          }
        },
        timeout: 180000,
      });

      if (response?.data) {
        toast.success('Answer submitted successfully!');
        
        // Move to next question or complete interview
        const isLastQuestion = currentQuestionIndex >= questions.length - 1;
        
        if (isLastQuestion) {
          localStorage.removeItem('currentInterviewSession');
          navigate('/interview-results', { 
            state: { 
              completed: true,
              sessionId: sessionId.current,
              totalQuestions: questions.length
            } 
          });
        } else {
          const nextIndex = currentQuestionIndex + 1;
          
          setCurrentQuestionIndex(nextIndex);
          setRecordedChunks([]);
          setIsRecording(false);
          setTranscribedText('');
          setUploadProgress(0);
          
          toast.success(`Moving to question ${nextIndex + 1} of ${questions.length}`);
        }
      }
    } catch (error: any) {
      toast.error('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Setting up your interview...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!interviewData || questions.length === 0) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600">No interview data available</p>
            <button 
              onClick={() => navigate('/interview-setup')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Setup
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Interview</h1>
            <div className="flex items-center justify-center space-x-4">
              <span className="text-lg text-gray-600">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <div className="w-64 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Question Panel */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Question</h3>
              <div className="bg-blue-50 p-6 rounded-lg">
                <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap break-words">
                  {currentQuestion?.text || 'Loading question...'}
                </p>
              </div>
              
              
              {/* Transcribed Text */}
              {isRecording && (
                <div className="mt-6">
                <div className="flex items-center space-x-2 mb-2">
                  <MessageSquare size={16} className="text-blue-600" />
                  <h4 className="text-md font-medium text-gray-900">Real-time Transcription</h4>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full animate-pulse">Live</span>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border min-h-[100px]">
                  <p className="text-gray-700 text-sm">
                    {transcribedText || 'Start speaking to see your transcription here...'}
                  </p>
                </div>
                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                  <p className="text-xs text-blue-700">
                    <strong>💡 Tip:</strong> If you make a mistake, click "Stop Recording" to clear the text, then "Start Recording" again for a fresh answer.
                  </p>
                </div>
              </div>
              )}

              {/* Upload Progress */}
              {submitting && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Uploading...</span>
                    <span className="text-sm text-gray-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Video Panel */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Video Recording</h3>
              
              <div className="relative bg-black rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
                <video 
                  ref={videoRef}
                  className="w-full h-auto max-h-[400px]"
                  autoPlay 
                  muted 
                  playsInline
                  style={{ display: 'block' }}
                />
                
                {/* Camera loading indicator */}
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Connecting to camera...</p>
                      <p className="text-sm text-gray-300 mt-2">Please allow camera access when prompted</p>
                    </div>
                  </div>
                )}
                
                
                {/* Recording indicator */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white text-sm font-medium bg-black bg-opacity-50 px-2 py-1 rounded">
                      Recording
                    </span>
                  </div>
                )}
              </div>

              {/* User Guidance */}
              {!isRecording && recordedChunks.length === 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>📝 Don't know the answer?</strong> You can either:
                    <br />• Start recording and say "I don't know" or explain what you do know
                    <br />• Click "Skip Question" to move to the next question
                  </p>
                </div>
              )}

              {/* Controls */}
              <div className="flex justify-center space-x-3 mt-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={submitting}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="w-5 h-5" />
                      <span>Stop Recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5" />
                      <span>Start Recording</span>
                    </>
                  )}
                </button>

                <button
                  onClick={submitAnswer}
                  disabled={recordedChunks.length === 0 || submitting}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                    recordedChunks.length > 0 && !submitting
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  <span>
                    {submitting ? 'Submitting...' : 'Submit Answer'}
                  </span>
                </button>

                <button
                  onClick={skipQuestion}
                  disabled={submitting}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    !submitting
                      ? 'bg-gray-600 hover:bg-gray-700 text-white'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span>
                    {submitting ? 'Skipping...' : 'Skip Question'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Interview;
