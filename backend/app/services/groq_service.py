from typing import Type

from langchain_openai import ChatOpenAI
from langsmith import traceable

from app.core.config import settings
from app.schemas.ai_models import PipelineSchemaT

_GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def get_chat_groq(model: str) -> ChatOpenAI:
    """Return a ChatOpenAI instance configured to use Groq's OpenAI-compatible endpoint."""
    return ChatOpenAI(
        api_key=settings.groq_api_key,
        base_url=_GROQ_BASE_URL,
        model=model,
    )


def structured_completion(messages: list[dict], model: str, schema: Type[PipelineSchemaT]) -> PipelineSchemaT:
    """
    Call Groq with structured output, returning a validated instance of the given schema.
    The return type is inferred from the schema passed — no casting needed at the call site.
    """
    llm = get_chat_groq(model).with_structured_output(schema, method="function_calling")
    return llm.invoke(messages)


@traceable(run_type="llm", name="groq_chat_completion")
def chat_completion(messages: list[dict], model: str) -> str:
    """Send messages to Groq and return the assistant text response."""
    response = get_chat_groq(model).invoke(messages)
    return response.content
