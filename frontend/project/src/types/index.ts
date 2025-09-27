export interface User {
  id: number;
  username: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
}

export interface InterviewAttempt {
  id: number;
  role: string;
  company: string;
  question: string;
  answer: string;
  feedback_text: string;
  overall_score: number;
  timestamp: string;
}

export interface PerformanceSummary {
  total_attempts: number;
  average_score_out_of_10: number;
  performance_percentage: number;
}

export interface Question {
  id: number;
  text: string;
}