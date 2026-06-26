from pydantic_settings import BaseSettings


class Settings(BaseSettings):
  # Database Postgres
  DATABASE_HOST: str
  DATABASE_PORT: int
  DATABASE_USERNAME: str
  DATABASE_PASSWORD: str
  DATABASE_NAME: str

  # JWT
  JWT_ALGORITHM: str
  JWT_ACCESS_SECRET: str

  # ChromaDB
  CHROMA_DB_HOST: str
  CHROMA_DB_PORT: int
  EMBEDDING_MODEL_NAME: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

  # Backend NestJS
  PORT_NEST: int
  HOST_NEST: str
  KEY_AUTH: str

  # FastAPI
  PORT_FASTAPI: int
  HOST_FASTAPI: str
  API_PREFIX: str

  class Config:
    env_file = ".env"


settings = Settings()
