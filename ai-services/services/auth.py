import jwt 
from schemas.user_interface import IUser
from fastapi import HTTPException, status
from core.settings import settings

class AuthService:
    # Decode token
    def decode_token(self, token: str) -> IUser:
        try:
            payload = jwt.decode(token, options={"verify_signature": False})

            return payload
        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # Verify token
    async def verify_token(self, token: str) -> IUser:
        try:
            result = jwt.decode(
                token,
                settings.JWT_ACCESS_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )

            return result

        except jwt.PyJWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
