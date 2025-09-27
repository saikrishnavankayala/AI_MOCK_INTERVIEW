# resume_parser.py
import fitz  # PyMuPDF
import re
import os

def extract_resume_text(filepath):
    """
    Enhanced resume parser that extracts and cleans text from PDF files
    """
    if not os.path.exists(filepath):
        raise Exception(f"Resume file not found: {filepath}")
    
    text = ""
    try:
        with fitz.open(filepath) as doc:
            for page in doc:
                page_text = page.get_text()
                text += page_text + "\n"
        
        # Clean and structure the extracted text
        cleaned_text = clean_resume_text(text)
        
        # Log the extracted content for debugging
        print(f"✅ Resume parsed successfully. Length: {len(cleaned_text)} characters")
        print(f"📄 Resume preview: {cleaned_text[:200]}...")
        
        return cleaned_text
        
    except Exception as e:
        print(f"❌ Resume parsing error: {e}")
        raise Exception(f"Failed to parse resume: {e}")

def clean_resume_text(raw_text):
    """
    Clean and structure resume text for better AI processing
    """
    if not raw_text or len(raw_text.strip()) < 50:
        raise Exception("Resume appears to be empty or too short")
    
    # Remove excessive whitespace and normalize line breaks
    text = re.sub(r'\n\s*\n', '\n\n', raw_text)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    # Ensure minimum content length
    if len(text) < 100:
        raise Exception("Resume content is too short to generate meaningful questions")
    
    return text

def extract_resume_sections(text):
    """
    Extract key sections from resume for targeted question generation
    """
    sections = {
        'skills': [],
        'experience': [],
        'education': [],
        'projects': []
    }
    
    # Simple keyword-based section extraction
    lines = text.split('\n')
    current_section = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # Detect section headers
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in ['skill', 'technical', 'programming']):
            current_section = 'skills'
        elif any(keyword in line_lower for keyword in ['experience', 'work', 'employment', 'internship']):
            current_section = 'experience'
        elif any(keyword in line_lower for keyword in ['education', 'academic', 'degree', 'university']):
            current_section = 'education'
        elif any(keyword in line_lower for keyword in ['project', 'portfolio', 'github']):
            current_section = 'projects'
        elif current_section and len(line) > 10:
            sections[current_section].append(line)
    
    return sections
