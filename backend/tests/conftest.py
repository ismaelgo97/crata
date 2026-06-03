"""
Shared fixtures for the entire test suite.

Infrastructure
--------------
- In-memory SQLite with StaticPool so every test gets an isolated, fresh DB
  without touching the filesystem.
- db_session: sets up tables before each test, tears them down after.
- client: FastAPI TestClient with get_db overridden to use the test session.

LLM layer
---------
- mock_chat_completion: patches chat_completion at the ai_pipelines import
  site, returning "laboral" by default (overridable per-test).
- mock_structured_completion: patches structured_completion at the
  ai_pipelines import site with a side_effect that returns sensible
  deterministic Pydantic instances based on the schema argument.
- mock_llm: convenience fixture that activates both patches together.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import MagicMock, patch

from main import app
from app.db.models import Base
from app.db.session import get_db
from app.schemas.ai_models import (
    BaseMetadata,
    LaboralMetadata,
    RedFlagAnalysis,
    RedFlagsOutput,
    SeverityEnum,
    SummaryOutput,
)

# ---------------------------------------------------------------------------
# Database infrastructure
# ---------------------------------------------------------------------------

_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


@pytest.fixture
def db_session():
    """Create all tables, yield a fresh session, drop everything after."""
    Base.metadata.create_all(bind=_ENGINE)
    session = _TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=_ENGINE)


@pytest.fixture
def client(db_session):
    """TestClient with get_db overridden to use the in-memory test session."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# LLM mock fixtures
# ---------------------------------------------------------------------------

# Default deterministic metadata returned when a metadata schema is requested
_DEFAULT_METADATA = LaboralMetadata(
    contract_type="laboral",
    parties=["Empresa Test S.L.", "Juan García López"],
    cif_nif=["B12345678", "12345678A"],
    effective_date="2025-06-01",
    duration="Indefinido",
    jurisdiction="Madrid",
    annual_gross_salary=32000.0,
    probation_months=2,
    job_title="Desarrollador de Software",
    collective_agreement="Convenio Colectivo de Consultoría",
)

_DEFAULT_RED_FLAGS = RedFlagsOutput(
    red_flags=[
        RedFlagAnalysis(
            clause_quote="El trabajador renuncia al cobro de horas extraordinarias.",
            issue="Renuncia anticipada a derechos irrenunciables.",
            law_reference="Art. 3.5 del Estatuto de los Trabajadores",
            severity=SeverityEnum.severe,
        )
    ]
)

_DEFAULT_SUMMARY = SummaryOutput(
    summary="Contrato laboral con cláusulas de riesgo detectadas.",
    overall_risk=SeverityEnum.high,
)


def _structured_side_effect(messages, model, schema):
    """Return a deterministic Pydantic instance matching the requested schema."""
    if issubclass(schema, BaseMetadata):
        return _DEFAULT_METADATA
    if schema is RedFlagsOutput:
        return _DEFAULT_RED_FLAGS
    if schema is SummaryOutput:
        return _DEFAULT_SUMMARY
    raise ValueError(f"Unexpected schema in test: {schema}")


@pytest.fixture
def mock_chat_completion():
    """Patch chat_completion in ai_pipelines to return 'laboral' by default."""
    with patch(
        "app.services.ai_pipelines.chat_completion",
        return_value="laboral",
    ) as mock:
        yield mock


@pytest.fixture
def mock_structured_completion():
    """Patch structured_completion in ai_pipelines with deterministic outputs."""
    with patch(
        "app.services.ai_pipelines.structured_completion",
        side_effect=_structured_side_effect,
    ) as mock:
        yield mock


@pytest.fixture
def mock_llm(mock_chat_completion, mock_structured_completion):
    """Convenience fixture: activates both LLM patches at once."""
    return mock_chat_completion, mock_structured_completion


# ---------------------------------------------------------------------------
# Contract data helpers
# ---------------------------------------------------------------------------

CONTRACT_TEXT = (
    "CONTRATO DE TRABAJO INDEFINIDO\n\n"
    "Empresa: Empresa Test S.L., CIF B12345678.\n"
    "Trabajador: Juan García López, DNI 12345678A.\n\n"
    "El trabajador es contratado como Desarrollador de Software.\n"
    "Salario bruto anual: 32.000 euros.\n"
    "Periodo de prueba: 2 meses.\n"
    "El trabajador renuncia al cobro de horas extraordinarias.\n"
)
