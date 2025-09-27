from groq import Groq
import os
from dotenv import load_dotenv

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def validate_answer_quality(answer, question):
    """
    Validates if the answer is meaningful and addresses the question.
    Returns validation result with feedback.
    """
    import re
    
    if not answer or not answer.strip():
        return {
            "is_valid": False,
            "feedback": "No answer was provided.",
            "communication_issue": "Complete silence or no response detected",
            "zero_reason": "No verbal response was given to the interview question"
        }
    
    # Clean and analyze the answer
    clean_answer = answer.strip().lower()
    word_count = len(clean_answer.split())
    
    # Check for very short answers (less than 5 words)
    if word_count < 5:
        return {
            "is_valid": False,
            "feedback": "Your response was too brief to demonstrate your knowledge and skills.",
            "communication_issue": "Extremely brief response with insufficient detail",
            "zero_reason": f"Answer contains only {word_count} words, which is insufficient for evaluation"
        }
    
    # Check for non-meaningful responses
    filler_words = ["um", "uh", "like", "you know", "basically", "actually", "well"]
    meaningless_phrases = [
        "i don't know", "not sure", "maybe", "i think", "i guess", 
        "no idea", "can't say", "don't remember", "not really"
    ]
    
    # Count meaningful words (excluding common fillers)
    meaningful_words = [word for word in clean_answer.split() 
                      if word not in filler_words and len(word) > 2]
    
    if len(meaningful_words) < 3:
        return {
            "is_valid": False,
            "feedback": "Your response consisted mainly of filler words without substantial content.",
            "communication_issue": "High ratio of filler words to meaningful content",
            "zero_reason": "Answer lacks meaningful content and substance"
        }
    
    # Check if answer is just saying "I don't know" variations
    for phrase in meaningless_phrases:
        if phrase in clean_answer and len(meaningful_words) < 8:
            return {
                "is_valid": False,
                "feedback": "Saying 'I don't know' without attempting to provide any relevant information.",
                "communication_issue": "Avoided answering the question entirely",
                "zero_reason": "Candidate did not attempt to answer the question"
            }
    
    # Check for minimum length (at least 15 words for a basic answer)
    if word_count < 15:
        return {
            "is_valid": False,
            "feedback": "Your answer needs more detail and explanation to properly evaluate your capabilities.",
            "communication_issue": "Response too brief to assess communication skills effectively",
            "zero_reason": f"Answer with {word_count} words is below minimum threshold for evaluation"
        }
    
    # If we reach here, the answer has sufficient content
    return {
        "is_valid": True,
        "word_count": word_count,
        "meaningful_words": len(meaningful_words)
    }

def generate_answer_structure(question):
    """
    Generates expected answer structure based on question type.
    """
    question_lower = question.lower()
    
    if "tell me about yourself" in question_lower:
        return "1) Brief professional background, 2) Key skills and experience, 3) Recent achievements, 4) Career goals"
    elif "experience" in question_lower or "project" in question_lower:
        return "1) Context/situation, 2) Your role and responsibilities, 3) Actions taken, 4) Results achieved"
    elif "strength" in question_lower or "weakness" in question_lower:
        return "1) Identify the strength/weakness, 2) Provide specific example, 3) Explain impact, 4) Show self-awareness"
    elif "why" in question_lower and ("company" in question_lower or "role" in question_lower):
        return "1) Research about company/role, 2) Alignment with your goals, 3) How you can contribute, 4) Specific examples"
    elif "challenge" in question_lower or "difficult" in question_lower:
        return "1) Describe the situation, 2) Explain the challenge, 3) Actions you took, 4) Outcome and lessons learned"
    else:
        return "1) Direct answer to the question, 2) Supporting examples or evidence, 3) Relevant experience, 4) Clear conclusion"

def validate_and_fix_ai_scores(ai_feedback, answer, question):
    """
    Validates AI feedback and ensures proper scoring format.
    Fixes missing or invalid scores.
    """
    import re
    
    # Check if feedback contains the required score patterns
    overall_score_match = re.search(r"OVERALL SCORE:\s*(\d+\.?\d*)\s*/\s*10", ai_feedback, re.IGNORECASE)
    confidence_score_match = re.search(r"CONFIDENCE_SCORE:\s*(\d+\.?\d*)\s*/\s*10", ai_feedback, re.IGNORECASE)
    communication_score_match = re.search(r"COMMUNICATION_SCORE:\s*(\d+\.?\d*)\s*/\s*10", ai_feedback, re.IGNORECASE)
    
    # If scores are missing or invalid, calculate them based on answer quality
    if not all([overall_score_match, confidence_score_match, communication_score_match]):
        validation = validate_answer_quality(answer, question)
        
        if validation["is_valid"]:
            # Calculate scores based on answer quality metrics
            word_count = validation["word_count"]
            meaningful_words = validation["meaningful_words"]
            
            # Base score calculation (more sophisticated than random)
            base_score = min(8, max(4, (word_count / 20) + (meaningful_words / 10)))
            
            # Add some variation for different aspects
            overall_score = round(base_score, 1)
            confidence_score = round(max(3, base_score - 0.5), 1)
            communication_score = round(min(9, base_score + 0.5), 1)
        else:
            # Invalid answers get zero scores
            overall_score = confidence_score = communication_score = 0
        
        # Append or fix the scores in the feedback
        if "**OVERALL SCORE:" not in ai_feedback:
            ai_feedback += f"\n\n**OVERALL SCORE: {overall_score}/10**"
        if "**CONFIDENCE_SCORE:" not in ai_feedback:
            ai_feedback += f"\n**CONFIDENCE_SCORE: {confidence_score}/10**"
        if "**COMMUNICATION_SCORE:" not in ai_feedback:
            ai_feedback += f"\n**COMMUNICATION_SCORE: {communication_score}/10**"
    
    return ai_feedback

def evaluate_answer(answer, question):
    """
    Generates comprehensive feedback with genuine scoring based on answer quality.
    Only gives marks when user provides meaningful answers.
    """
    import re
    
    # Validate answer quality first
    answer_validation = validate_answer_quality(answer, question)
    
    if not answer_validation["is_valid"]:
        return f"**Core Feedback:** {answer_validation['feedback']}\n\n**Communication Skills:**\n* {answer_validation['communication_issue']}\n* No meaningful content to evaluate\n* Answer does not address the question asked\n\n**Improvement Tips:**\n* Listen carefully to the question and provide a relevant response\n* Structure your answer with clear points and examples\n* Speak for at least 30-60 seconds to provide sufficient detail\n* Practice articulating your thoughts clearly\n\n**OVERALL SCORE: 0/10**\n**CONFIDENCE_SCORE: 0/10**\n**COMMUNICATION_SCORE: 0/10**\n\n**Reason for Zero Score:** {answer_validation['zero_reason']}\n\n**Expected Answer Structure:** {generate_answer_structure(question)}\n"
    
    prompt = f"""
    Analyze the following interview answer and provide detailed, personalized feedback with genuine dynamic scoring.

    **Interview Question:** "{question}"
    **Candidate's Answer:** "{answer}"

    **Instructions:**
    Provide a comprehensive evaluation that feels personalized to this specific answer. Structure it exactly like this:

    1. **Core Feedback:** 2-3 sentences explaining how well the answer addressed the question, highlighting specific strengths and weaknesses.
    
    2. **Communication Skills:** 3-4 bullet points analyzing their communication style, including:
       * Clarity and organization of thoughts
       * Use of specific examples and evidence
       * Conciseness vs. comprehensiveness
       * Professional language and terminology
    
    3. **Improvement Tips:** 3-4 actionable bullet points focused on improving both content and delivery, including:
       * Specific content that could be added
       * Structure improvements
       * Language refinements
       * Delivery suggestions
    
    4. **Scoring:** Provide THREE different scores that genuinely reflect different aspects:
       * OVERALL SCORE: [score]/10 - Overall answer quality
       * CONFIDENCE_SCORE: [score]/10 - How confident and assured the answer sounds
       * COMMUNICATION_SCORE: [score]/10 - Clarity and communication effectiveness
       
       Make these scores vary based on the actual content and quality of the answer. Don't make them all the same.
    
    5. **Suggested Answer:** Provide a model answer that demonstrates best practices while incorporating elements from the candidate's original response where appropriate.

    Make the feedback feel like it comes from an experienced interviewer who has carefully considered this specific answer. Ensure the three scores are different and reflect genuine assessment of different aspects.
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500
        )
        ai_feedback = response.choices[0].message.content
        
        # Ensure the AI feedback contains valid scores
        validated_feedback = validate_and_fix_ai_scores(ai_feedback, answer, question)
        return validated_feedback
        
    except Exception as e:
        return f"**Core Feedback:** Error occurred during evaluation.\n\n**OVERALL SCORE: 0/10**\n**CONFIDENCE_SCORE: 0/10**\n**COMMUNICATION_SCORE: 0/10**\n\n**Error:** {str(e)}"
