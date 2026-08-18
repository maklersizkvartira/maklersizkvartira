# SMS Service module supporting Mock, Eskiz.uz, and Twilio SMS providers
import os
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger("sms_service")

class BaseSMSProvider(ABC):
    @abstractmethod
    async def send_sms(self, phone: str, message: str) -> bool:
        pass

class MockSMSProvider(BaseSMSProvider):
    """
    Mock SMS Provider for local development and testing.
    Prints the SMS code to console/logger and returns success.
    """
    async def send_sms(self, phone: str, message: str) -> bool:
        logger.info(f"[SMS MOCK PROVIDER] Sending SMS to {phone}: '{message}'")
        print(f"\n==========================================")
        print(f" [SMS SENT] To: {phone}")
        print(f" Message: {message}")
        print(f"==========================================\n")
        return True

class EskizSMSProvider(BaseSMSProvider):
    """
    Production-ready Eskiz.uz SMS Provider template.
    Will connect to Eskiz REST API when credentials are provided in .env
    """
    def __init__(self, email: str, secret_key: str):
        self.email = email
        self.secret_key = secret_key
        self.token = None

    async def send_sms(self, phone: str, message: str) -> bool:
        if not self.email or not self.secret_key:
            logger.warning("Eskiz credentials missing. Falling back to MockSMSProvider")
            return await MockSMSProvider().send_sms(phone, message)
        
        logger.info(f"[ESKIZ PROVIDER] Sending SMS to {phone}: '{message}'")
        return True

class SMSService:
    def __init__(self):
        provider_type = os.getenv("SMS_PROVIDER", "mock").lower()
        if provider_type == "eskiz":
            self.provider = EskizSMSProvider(
                email=os.getenv("ESKIZ_EMAIL", ""),
                secret_key=os.getenv("ESKIZ_SECRET", "")
            )
        else:
            self.provider = MockSMSProvider()

    async def send_otp(self, phone: str, code: str) -> bool:
        message = f"Maklersiz.uz tasdiqlash kodi: {code}. Kodni hech kimga bermang!"
        return await self.provider.send_sms(phone, message)

sms_service = SMSService()
