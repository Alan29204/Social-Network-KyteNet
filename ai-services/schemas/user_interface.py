from pydantic import BaseModel

class IUser(BaseModel):
    id: str
    role: str
    iat: int
    exp: int

