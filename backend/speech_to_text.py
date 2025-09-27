# speech_to_text.py
import speech_recognition as sr
import os
from pydub import AudioSegment
import tempfile

def transcribe_audio(audio_path):
    r = sr.Recognizer()
    if not os.path.exists(audio_path):
        return "Error: Audio file not found"
    
    wav_path = audio_path
    try:
        if not audio_path.lower().endswith('.wav'):
            sound = AudioSegment.from_file(audio_path)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                wav_path = tmp.name
                sound.export(wav_path, format="wav")

        with sr.AudioFile(wav_path) as source:
            r.adjust_for_ambient_noise(source, duration=0.5)
            audio = r.record(source)
            text = r.recognize_google(audio, language="en-US")
            return text
    except sr.UnknownValueError:
        return "Could not understand audio - try speaking more clearly"
    except sr.RequestError as e:
        return f"Speech recognition service error: {str(e)}"
    except Exception as e:
        return f"Transcription error: {str(e)}"
    finally:
        if wav_path != audio_path and os.path.exists(wav_path):
            os.remove(wav_path)
