import React, { useState, useEffect } from "react";
import { Clock, Briefcase, Building2, MessageSquare, Calendar, ChevronRight } from "lucide-react";
import Layout from "../components/Layout";
import api from "../config/api";
import toast from "react-hot-toast";
import { InterviewAttempt } from "../types";

const History: React.FC = () => {
  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttempts();
  }, []);

  const fetchAttempts = async () => {
    try {
      const response = await api.get("/api/attempts");
      setAttempts(response.data.attempts || []);
    } catch (error) {
      toast.error("Failed to load interview history");
      console.error("Error fetching attempts:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview History</h1>
          <p className="text-gray-600">Review your past interview attempts and performance</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
            </div>
          </div>
        ) : attempts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="text-blue-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Interview History Yet</h2>
            <p className="text-gray-600 mb-6">Complete your first interview to see your history here</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {attempts.map((attempt, index) => (
                <div key={index} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="mb-4 md:mb-0">
                      <div className="flex items-center mb-2">
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2">
                          {attempt.role}
                        </span>
                        <span className="text-gray-500 text-sm flex items-center">
                          <Building2 size={14} className="mr-1" />
                          {attempt.company}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{attempt.question}</h3>
                      <div className="flex items-center text-gray-500 text-sm">
                        <Calendar size={14} className="mr-1" />
                        <span>{formatDate(attempt.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <div className="mr-6">
                        <div className="text-sm text-gray-500 mb-1">Overall Score</div>
                        <div className="text-xl font-bold text-gray-900">
                          {(attempt as any).feedback?.includes("score")
                            ? (attempt as any).feedback?.match(/score:\s*(\d+)/i)?.[1] || "N/A"
                            : "N/A"}
                        </div>
                      </div>
                      <button 
                        className="p-2 rounded-full hover:bg-gray-200 transition-colors"
                        onClick={() => {
                          // Implement detailed view if needed
                          toast.success("Detailed view coming soon!");
                        }}
                      >
                        <ChevronRight size={20} className="text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default History;
