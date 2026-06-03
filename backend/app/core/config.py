from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Contract Risk Analyser"
    debug: bool = False

    groq_api_key: str = ""

    # LangSmith tracing
    langsmith_tracing: str = "false"
    langsmith_endpoint: str = "https://eu.api.smith.langchain.com"
    langsmith_api_key: str = ""
    langsmith_project: str = "contract-risk-analyser"

    # Model used to classify the contract type (fast, lightweight)
    groq_model_classification: str = "llama-3.1-8b-instant"

    # Model used to extract structured data from the contract text
    groq_model_extraction: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # Model used to detect and analyse red flags and risky clauses
    groq_model_red_flags: str = "llama-3.3-70b-versatile"

    # Model used to produce the executive summary and assign overall risk level
    groq_model_summary: str = "llama-3.3-70b-versatile"

    database_url: str = "sqlite:///./contracts.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
