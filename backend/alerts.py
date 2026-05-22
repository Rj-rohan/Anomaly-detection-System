import os, requests, smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

def send_telegram(message: str):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return
    requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                  json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})

def send_email(subject: str, body: str):
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", 587))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    to = os.getenv("ALERT_EMAIL")
    if not all([host, user, password, to]):
        return
    msg = MIMEText(body, "html")
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to
    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, password)
        s.sendmail(user, [to], msg.as_string())

def dispatch_alert(user_name: str, risk_score: int, reasons: list, severity: str):
    icon = "🔴" if severity == "Critical" else "🚨" if severity == "High" else "⚠️"
    text = (
        f"{icon} <b>Security Alert — {severity}</b>\n\n"
        f"User: <b>{user_name}</b>\n"
        f"Risk Score: <b>{risk_score}</b>\n"
        f"Anomalies Detected:\n" + "\n".join(f"• {r}" for r in reasons) +
        f"\nSeverity: <b>{severity}</b>"
    )
    send_telegram(text)
    send_email(f"Security Alert – {user_name}", text.replace("\n", "<br>"))
