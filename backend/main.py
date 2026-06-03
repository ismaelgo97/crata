import os

from fastapi import FastAPI

from app.api.v1.endpoints.contract import router as contract_router
from app.core.config import settings

from fastapi.middleware.cors import CORSMiddleware

# LangSmith requires these to be set as real OS env vars before LangChain imports
os.environ["LANGSMITH_TRACING"] = settings.langsmith_tracing
os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint
os.environ["LANGSMITH_API_KEY"] = settings.langsmith_api_key
os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project

app = FastAPI(title="Contract Risk Analyser", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contract_router, prefix="/api/v1/contracts", tags=["contracts"])
