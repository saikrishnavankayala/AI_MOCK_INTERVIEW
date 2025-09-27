import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Briefcase, Building2, Target, ArrowRight, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../config/api';
import { ROLES, TOP_INDIAN_COMPANIES, ROUND_TYPES } from '../data/constants';
import toast from 'react-hot-toast';

const InterviewSetup: React.FC = () => {
  const [step, setStep] = useState(1);
  const [resumeText, setResumeText] = useState('');
  const [skipResume, setSkipResume] = useState(false);
  const [formData, setFormData] = useState({
    role: '',
    company: '',
    roundType: 'technical'
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/api/upload-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setResumeText(response.data.resume_text);
      toast.success('Resume uploaded successfully!');
      setStep(2);
    } catch (error) {
      toast.error('Failed to upload resume');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = async () => {
    if (!formData.role || !formData.company) {
      toast.error('Please select both role and company');
      return;
    }

    const interviewData = {
      ...formData,
      resumeText: skipResume ? '' : resumeText
    };

    // Log the data being saved to localStorage for debugging
    console.log('Saving interview setup data:', interviewData);
    
    localStorage.setItem('interviewSetup', JSON.stringify(interviewData));
    navigate('/interview');
  };
  
  const handleSkipResume = () => {
    setSkipResume(true);
    setStep(2);
    toast.success('Proceeding without resume. Questions will be based on role and company.');
  };

  const stepIndicator = (stepNumber: number, title: string, isActive: boolean, isCompleted: boolean) => (
    <div className="flex items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
        isCompleted ? 'bg-green-500 text-white' :
        isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
      }`}>
        {stepNumber}
      </div>
      <span className={`ml-3 font-medium ${isActive ? 'text-blue-600' : 'text-gray-600'}`}>
        {title}
      </span>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            {stepIndicator(1, 'Upload Resume', step === 1, step > 1)}
            <div className="flex-1 h-1 mx-4 bg-gray-200 rounded">
              <div className={`h-full bg-blue-600 rounded transition-all duration-300 ${
                step > 1 ? 'w-full' : 'w-0'
              }`}></div>
            </div>
            {stepIndicator(2, 'Select Details', step === 2, false)}
          </div>
        </div>

        {/* Step 1: Resume Upload */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Upload className="text-blue-600" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Resume</h2>
              <p className="text-gray-600 mb-8">Upload your resume to generate personalized interview questions</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  className="hidden"
                  id="resume-upload"
                  disabled={loading}
                />
                <label
                  htmlFor="resume-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <FileText className="text-gray-400 mb-4" size={48} />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {loading ? 'Processing...' : 'Click to upload resume'}
                  </p>
                  <p className="text-gray-500">PDF files only, max 10MB</p>
                </label>
              </div>

              {resumeText && (
                <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-green-800 font-medium mb-2">Resume processed successfully!</p>
                  <div className="text-sm text-green-700 text-left max-h-32 overflow-y-auto">
                    {resumeText.substring(0, 200)}...
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-all inline-flex items-center space-x-2"
                  >
                    <span>Continue</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              
              <div className="mt-8 border-t pt-6">
                <button
                  onClick={handleSkipResume}
                  className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center space-x-2"
                >
                  <AlertCircle size={16} />
                  <span>Skip resume upload and proceed with role-based questions</span>
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  You can still get relevant questions based on your selected role and company
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Interview Details */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="text-center mb-8">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Target className="text-purple-600" size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Setup</h2>
              <p className="text-gray-600">Configure your interview preferences</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Briefcase className="inline mr-2" size={16} />
                  Select Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a role...</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Company Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Building2 className="inline mr-2" size={16} />
                  Select Company
                </label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a company...</option>
                  {TOP_INDIAN_COMPANIES.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Round Type Selection */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Interview Round Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ROUND_TYPES.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.roundType === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      checked={formData.roundType === type.value}
                      onChange={(e) => setFormData({ ...formData, roundType: e.target.value })}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{type.label}</p>
                      <p className="text-sm text-gray-600">
                        {type.value === 'technical' 
                          ? 'Focus on technical skills and problem-solving'
                          : 'Focus on behavioral questions and soft skills'
                        }
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Back to Resume
              </button>
              <button
                onClick={handleSetupComplete}
                disabled={!formData.role || !formData.company}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center space-x-2"
              >
                <span>Start Interview</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default InterviewSetup;