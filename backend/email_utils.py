# backend/email_utils.py

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

def send_otp_email(recipient_email, otp):
    """Sends an email with the OTP code."""
    
    sender_email = os.getenv("EMAIL_HOST_USER")
    sender_password = os.getenv("EMAIL_HOST_PASSWORD")
    
    if not sender_email or not sender_password:
        print("🔥 ERROR: Email credentials are not set in the .env file.")
        return False

    # Create the email message
    message = MIMEMultipart("alternative")
    message["Subject"] = "Your Verification Code"
    message["From"] = sender_email
    message["To"] = recipient_email

    # Create the plain-text and HTML version of your message
    text = f"Hi,\n\nYour OTP code is: {otp}\nThis code will expire in 10 minutes."
    
    html = f"""
    <html>
      <body>
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Verification Code</h2>
          <p>Hi,</p>
          <p>Thank you for signing up. Please use the following One-Time Password (OTP) to complete your registration:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #333;">{otp}</p>
          <p>This code is valid for the next 10 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <br>
          <p>Best regards,<br>The AI Interview Team</p>
        </div>
      </body>
    </html>
    """

    # Turn these into plain/html MIMEText objects
    part1 = MIMEText(text, "plain")
    part2 = MIMEText(html, "html")

    # Add HTML/plain-text parts to MIMEMultipart message
    message.attach(part1)
    message.attach(part2)

    try:
        # Create secure connection with server and send email
        context = smtplib.ssl.create_default_context()
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, message.as_string())
        print(f"✅ OTP email sent successfully to {recipient_email}")
        return True
    except Exception as e:
        print(f"🔥 ERROR sending email: {e}")
        return False
