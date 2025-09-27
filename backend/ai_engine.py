import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_linkedin_questions_ai(profile_data):
    """Generate questions based on LinkedIn profile data"""
    headline = profile_data.get("headline", "N/A")
    posts_summary = "\n".join([f"- Post: \"{p['post_content'][:150]}...\"" for p in profile_data.get("recent_posts", [])])
    activity_summary = "\n".join([f"- Activity: {a}" for a in profile_data.get("activity", [])])
    
    prompt = f"""
    You are a sharp HR interviewer. You have researched the candidate's LinkedIn profile.
    Generate exactly 5 thought-provoking questions based on their recent activity.
    
    **Candidate's LinkedIn Summary:**
    - Headline: {headline}
    - Recent Posts: {posts_summary}
    - Recent Activity: {activity_summary}
    
    Ask open-ended questions about their posts or activity to understand their passion.
    Format each question as: "1. Question text here"
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[{"role": "user", "content": prompt}], 
            temperature=0.8, 
            max_tokens=500
        )
        content = response.choices[0].message.content
        print(f"🤖 LinkedIn AI Response: {content[:200]}...")
        
        # Extract numbered questions
        question_lines = [q.strip() for q in content.split("\n") if q.strip() and any(q.strip().startswith(f"{i}.") for i in range(1, 10))]
        return question_lines if question_lines else [q.strip() for q in content.split("\n") if q.strip() and len(q.strip()) > 10]
        
    except Exception as e:
        print(f"❌ LinkedIn question generation error: {e}")
        return [f"Error generating LinkedIn questions: {str(e)}"]

def generate_questions_ai(role, resume, company, round_type):
    """Generate interview questions based on role, resume, company and round type"""
    
    print(f"🎯 Generating {round_type} questions for {role} at {company}")
    print(f"📄 Resume content length: {len(resume)} chars")
    
    if not resume or len(resume.strip()) < 50:
        print("⚠️ Warning: Resume content is very short or empty")
        resume = "No detailed resume provided"
    
    if round_type.lower() == 'hr':
        prompt = f"""
        You are a senior HR Manager at {company} conducting a behavioral interview for a {role} position.
        
        Generate exactly 5 interview questions following this structure:
        1. **Introduction:** "Tell me about yourself and your background."
        2. **Project-Based:** Ask a specific question about a project mentioned in the resume.
        3. **Experience-Based:** Ask about work experience, internships, or certifications from the resume.
        4. **Behavioral:** Ask a classic behavioral question (strengths, weaknesses, handling challenges).
        5. **Motivation & Fit:** Ask about their motivation for this role and company.
        
        **Candidate's Resume Content:**
        {resume}
        
        **Instructions:**
        - Make questions specific to the resume content when possible
        - Use professional, engaging language
        - Format each question as "1. Question text here"
        - Ensure questions are relevant to the {role} position
        """
    else:
        prompt = f"""
        You are a Senior {role} conducting a technical interview for a {role} position at {company}.
        
        Generate exactly 5 technical interview questions:
        1. **Resume-Specific:** Ask about a specific technology or project mentioned in the resume.
        2. **Resume-Specific:** Ask about another technology or framework from the resume.
        3. **Resume-Specific:** Ask about a challenging problem they solved (based on resume).
        4. **Role-Based:** Ask a general technical question relevant to {role}.
        5. **Problem-Solving:** Ask a technical problem-solving or system design question.
        
        **Candidate's Resume Content:**
        {resume}
        
        **Instructions:**
        - Make questions specific to technologies/projects in the resume
        - Use technical language appropriate for {role}
        - Format each question as "1. Question text here"
        - Ensure questions test both knowledge and problem-solving skills
        """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant", 
            messages=[{"role": "user", "content": prompt}], 
            temperature=0.8, 
            max_tokens=800
        )
        content = response.choices[0].message.content
        print(f"🤖 AI Response: {content[:300]}...")
        
        # Extract numbered questions more reliably
        lines = content.split('\n')
        questions = []
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Look for numbered questions (1., 2., etc.)
            for i in range(1, 10):
                if line.startswith(f"{i}.") and len(line) > 10:
                    questions.append(line)
                    break
        
        # If we didn't find numbered questions, try alternative parsing
        if not questions:
            questions = [q.strip() for q in lines if q.strip() and len(q.strip()) > 20 and '?' in q]
        
        # Ensure we have at least some questions
        if not questions:
            questions = [
                "1. Tell me about yourself and your background.",
                "2. What interests you most about this role?",
                "3. Describe a challenging project you've worked on.",
                "4. What are your key strengths and areas for improvement?",
                "5. Why do you want to work at our company?"
            ]
        
        print(f"✅ Generated {len(questions)} questions")
        return questions[:5]  # Return max 5 questions
        
    except Exception as e:
        print(f"❌ Question generation error: {e}")
        return [f"Error generating questions: {str(e)}"]