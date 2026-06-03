"""
LangGraph orchestration pipeline for contract risk analysis.

Flow:
  classify → (unsupported?) → END  (fast-fail, saves cost)
           → extract_metadata
           → analyse_red_flags   (loads reference JSON via tool)
           → summarise
           → END

State uses channel reducers:
  - Most fields: last-write-wins (default)
  - red_flags: Annotated with operator.add so each node appends its slice
    without knowing or touching the rest of the list.
"""

import json
import operator
from pathlib import Path
from typing import Annotated, Any, List, NamedTuple, Optional, TypedDict

from langgraph.graph import END, StateGraph

from app.core.config import settings
from app.schemas.contract import ContractSupportedTypes, ContractTypes
from app.schemas.ai_models import (
    AlquilerMetadata,
    CompraventaMetadata,
    ContractReferenceData,
    LaboralMetadata,
    NdaMetadata,
    RedFlagAnalysis,
    RedFlagsOutput,
    ServiciosMetadata,
    SeverityEnum,
    SpecificMetadata,
    SummaryOutput,
)
from app.services.groq_service import chat_completion, structured_completion

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

SUPPORTED_TYPES = {t.value for t in ContractSupportedTypes}


class CriticalFieldConfig(NamedTuple):
    field_name: str
    issue_description: str
    law_reference: str
    severity: str


_CRITICAL_FIELDS: dict[str, list[CriticalFieldConfig]] = {
    "alquiler":    [CriticalFieldConfig("rent_amount",                   "Renta no especificada en el contrato",            "Art. 17 de la LAU",          "high")],
    "compraventa": [CriticalFieldConfig("total_price",                   "Precio de compraventa no especificado",           "Art. 1445 del Código Civil",  "high")],
    "laboral":     [CriticalFieldConfig("annual_gross_salary",           "Salario no especificado en el contrato",          "Art. 26.1 del ET",            "high")],
    "servicios":   [CriticalFieldConfig("payment_terms_days",            "Plazo de pago no especificado",                   "Art. 4 Ley 3/2004",           "medium")],
    "nda":         [CriticalFieldConfig("confidentiality_duration_years","Duración de la confidencialidad no especificada", "Art. 1 Ley 1/2019",           "medium")],
}

_METADATA_SCHEMAS = {
    "alquiler":    AlquilerMetadata,
    "compraventa": CompraventaMetadata,
    "laboral":     LaboralMetadata,
    "nda":         NdaMetadata,
    "servicios":   ServiciosMetadata,
}

# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------

class PipelineState(TypedDict):
    contract_text: str
    contract_type: Optional[ContractTypes]
    metadata: Optional[SpecificMetadata]
    red_flags: Annotated[List[RedFlagAnalysis], operator.add]
    summary: Optional[str]
    overall_risk: Optional[SeverityEnum]
    unsupported: bool


# ---------------------------------------------------------------------------
# Reference data loader
# ---------------------------------------------------------------------------

def load_contract_reference(contract_type: str) -> ContractReferenceData:
    """Load and parse the reference JSON for the given contract type."""
    path = DATA_DIR / f"{contract_type}.json"
    return ContractReferenceData.model_validate_json(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

def _classify(state: PipelineState) -> dict:
    system = (
        "Eres un clasificador de contratos jurídicos españoles. "
        "Responde ÚNICAMENTE con una de estas palabras exactas en minúsculas, sin explicación ni puntuación:\n"
        "alquiler | compraventa | servicios | laboral | nda | unsupported\n\n"
        "Responde 'unsupported' si el documento no es ninguno de esos tipos o no es un contrato."
    )
    user = f"Clasifica el siguiente documento:\n\n{state['contract_text'][:3000]}"

    raw = chat_completion(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        model=settings.groq_model_classification,
    ).strip().lower()

    detected = raw if raw in SUPPORTED_TYPES else "unsupported"
    return {"contract_type": ContractTypes(detected), "unsupported": detected == "unsupported"}


def _extract_metadata(state: PipelineState) -> dict:
    schema = _METADATA_SCHEMAS[state["contract_type"]]

    system = (
        "Eres un extractor de datos estructurados de contratos jurídicos españoles. "
        "Extrae los campos del esquema proporcionado. "
        "Si un campo no aparece en el texto, usa null. "
        "Devuelve tu respuesta en formato JSON."
    )
    user = f"Texto del contrato:\n{state['contract_text']}"

    metadata: SpecificMetadata = structured_completion(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        model=settings.groq_model_extraction,
        schema=schema,
    )

    return {"metadata": metadata}


def _analyse_red_flags(state: PipelineState) -> dict:
    reference: ContractReferenceData = load_contract_reference(state["contract_type"].value)

    few_shot_block = "\n\n".join(
        f"Cláusula: \"{ex.clause_text}\"\n"
        f"Red flag: {ex.matched_red_flag}\n"
        f"Problema: {ex.issue}\n"
        f"Referencia legal: {ex.law_reference}\n"
        f"Severidad: {ex.severity}"
        for ex in reference.few_shot_examples
    )

    metadata_dict = state["metadata"].model_dump() if state["metadata"] else {}
    missing_flags: List[RedFlagAnalysis] = [
        RedFlagAnalysis(
            clause_quote="[Campo no encontrado en el documento]",
            issue=cfg.issue_description,
            law_reference=cfg.law_reference,
            severity=cfg.severity,
        )
        for cfg in _CRITICAL_FIELDS.get(state["contract_type"].value, [])
        if metadata_dict.get(cfg.field_name) is None
    ]

    system = (
        "Eres un abogado experto en derecho español. Analiza el contrato y detecta todas las cláusulas "
        "abusivas, ilegales o de riesgo. Usa el marco legal y los ejemplos como guía.\n\n"
        f"Marco legal aplicable: {', '.join(reference.legal_framework)}\n\n"
        "Red flags conocidas para este tipo de contrato:\n- " + "\n- ".join(reference.red_flags) + "\n\n"
        f"Ejemplos de identificación de red flags:\n{few_shot_block}\n\n"
        "Devuelve tu respuesta en formato JSON con el campo 'red_flags' como lista de objetos "
        "con los campos: clause_quote, issue, law_reference, severity (low|medium|high|severe)."
    )
    user = f"Texto del contrato:\n\n{state['contract_text']}"

    result: RedFlagsOutput = structured_completion(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        model=settings.groq_model_red_flags,
        schema=RedFlagsOutput,
    )

    return {"red_flags": missing_flags + result.red_flags}


def _summarise(state: PipelineState) -> dict:
    system = (
        "Eres un abogado senior especializado en derecho español. "
        "A partir de los metadatos y las red flags detectadas, redacta un resumen ejecutivo del contrato "
        "y asigna un nivel de riesgo global. "
        "Devuelve tu respuesta en formato JSON con los campos: summary (string) y overall_risk (low|medium|high|severe)."
    )
    user = (
        f"Tipo de contrato: {state['contract_type'].value}\n\n"
        f"Metadatos:\n{json.dumps(state['metadata'].model_dump() if state['metadata'] else {}, ensure_ascii=False, indent=2)}\n\n"
        f"Red flags:\n{json.dumps([f.model_dump() for f in state['red_flags']], ensure_ascii=False, indent=2)}"
    )

    result: SummaryOutput = structured_completion(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        model=settings.groq_model_summary,
        schema=SummaryOutput,
    )

    return {"summary": result.summary, "overall_risk": result.overall_risk}


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def _route_after_classify(state: PipelineState) -> str:
    return END if state["unsupported"] else "extract_metadata"


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------

def _build_graph() -> Any:
    builder = StateGraph(PipelineState)

    builder.add_node("classify", _classify)
    builder.add_node("extract_metadata", _extract_metadata)
    builder.add_node("analyse_red_flags", _analyse_red_flags)
    builder.add_node("summarise", _summarise)

    builder.set_entry_point("classify")
    builder.add_conditional_edges("classify", _route_after_classify)
    builder.add_edge("extract_metadata", "analyse_red_flags")
    builder.add_edge("analyse_red_flags", "summarise")
    builder.add_edge("summarise", END)

    return builder.compile()


_graph = _build_graph()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_analysis_pipeline(contract_text: str) -> dict:
    """
    Run the full analysis pipeline on a contract.
    Returns a dict ready to be JSON-serialised and stored as ai_output.
    """
    final: PipelineState = _graph.invoke({
        "contract_text": contract_text,
        "contract_type": None,
        "metadata": None,
        "red_flags": [],
        "summary": None,
        "overall_risk": None,
        "unsupported": False,
    })

    if final["unsupported"]:
        return {
            "unsupported": True,
            "contract_type": ContractTypes.unsupported.value,
            "message": "Contrato no es de tipo soportado",
        }

    return {
        "unsupported": False,
        "contract_type": final["contract_type"].value,
        "metadata": final["metadata"].model_dump() if final["metadata"] else None,
        "red_flags": [f.model_dump() for f in final["red_flags"]],
        "summary": final["summary"],
        "overall_risk": final["overall_risk"].value if final["overall_risk"] else None,
    }
