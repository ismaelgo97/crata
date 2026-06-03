from enum import Enum
from typing import List, Literal, Optional, Type, TypeVar, Union

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Severity
# ---------------------------------------------------------------------------

class SeverityEnum(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    severe = "severe"


# ---------------------------------------------------------------------------
# Red flag
# ---------------------------------------------------------------------------

class RedFlagAnalysis(BaseModel):
    clause_quote: str = Field(
        ...,
        description="Cita textual y exacta del fragmento del contrato donde se detecta el riesgo.",
    )
    issue: str = Field(
        ...,
        description="Explicación detallada de por qué esta cláusula supone un riesgo bajo el derecho español.",
    )
    law_reference: str = Field(
        ...,
        description="Artículo o norma específica infringida (ej. 'Art. 11 de la LAU').",
    )
    severity: SeverityEnum = Field(..., description="Nivel de severidad del riesgo.")


# ---------------------------------------------------------------------------
# Base metadata (common to all contract types)
# ---------------------------------------------------------------------------

class BaseMetadata(BaseModel):
    parties: List[str] = Field(
        ...,
        description="Partes firmantes del contrato (nombre completo o razón social).",
    )
    cif_nif: List[str] = Field(
        default_factory=list,
        description="DNI, NIF o CIF de las partes en el mismo orden que 'parties'.",
    )
    effective_date: Optional[str] = Field(
        None,
        description="Fecha de entrada en vigor del contrato (formato YYYY-MM-DD).",
    )
    duration: Optional[str] = Field(
        None,
        description="Periodo de validez estipulado (ej. '1 año', 'Indefinido', '6 meses').",
    )
    jurisdiction: Optional[str] = Field(
        None,
        description="Ciudad o tribunales pactados para resolver disputas (ej. 'Madrid').",
    )


# ---------------------------------------------------------------------------
# Contract-type specific metadata
# ---------------------------------------------------------------------------

class AlquilerMetadata(BaseMetadata):
    contract_type: Literal["alquiler"] = "alquiler"
    rent_amount: Optional[float] = Field(None, description="Renta mensual en euros.")
    deposit_months: Optional[int] = Field(None, description="Número de meses de fianza legal entregados.")
    property_address: Optional[str] = Field(None, description="Dirección física completa del inmueble arrendado.")
    catastral_reference: Optional[str] = Field(None, description="Referencia catastral del inmueble si aparece.")


class CompraventaMetadata(BaseMetadata):
    contract_type: Literal["compraventa"] = "compraventa"
    total_price: Optional[float] = Field(None, description="Precio total acordado para la transmisión.")
    arras_amount: Optional[float] = Field(None, description="Importe entregado en concepto de arras o señal.")
    arras_type: Optional[Literal["penitenciales", "confirmatorias", "penales"]] = Field(
        None,
        description="Tipo de arras identificadas en el contrato.",
    )
    deed_deadline: Optional[str] = Field(None, description="Fecha límite pactada para elevar a escritura pública.")


class LaboralMetadata(BaseMetadata):
    contract_type: Literal["laboral"] = "laboral"
    annual_gross_salary: Optional[float] = Field(None, description="Salario bruto anual en euros.")
    probation_months: Optional[int] = Field(None, description="Duración del periodo de prueba en meses.")
    job_title: Optional[str] = Field(None, description="Puesto de trabajo o categoría profesional.")
    collective_agreement: Optional[str] = Field(None, description="Convenio colectivo sectorial o de empresa aplicable.")


class NdaMetadata(BaseMetadata):
    contract_type: Literal["nda"] = "nda"
    confidentiality_duration_years: Optional[int] = Field(
        None,
        description="Años que persiste la obligación de secreto tras finalizar la relación.",
    )
    permitted_disclosures: Optional[List[str]] = Field(
        default_factory=list,
        description="Excepciones donde se permite revelar información (ej. 'orden judicial').",
    )


class ServiciosMetadata(BaseMetadata):
    contract_type: Literal["servicios"] = "servicios"
    payment_terms_days: Optional[int] = Field(None, description="Plazo de pago acordado en días (ej. 30, 60).")
    liability_cap: Optional[str] = Field(None, description="Límite máximo de responsabilidad económica pactado.")
    exclusivity: bool = Field(False, description="¿Existe cláusula de exclusividad para el prestador?")


# ---------------------------------------------------------------------------
# Discriminated union of all metadata types
# ---------------------------------------------------------------------------

SpecificMetadata = Union[
    AlquilerMetadata,
    CompraventaMetadata,
    LaboralMetadata,
    NdaMetadata,
    ServiciosMetadata,
]


# ---------------------------------------------------------------------------
# Full analysis result
# ---------------------------------------------------------------------------

class FullAIAnalysisResult(BaseModel):
    summary: str = Field(
        ...,
        description="Resumen ejecutivo del contrato orientado a una lectura rápida por parte del abogado.",
    )
    overall_risk: SeverityEnum = Field(
        ...,
        description="Nivel de riesgo global asignado al contrato.",
    )
    metadata: SpecificMetadata = Field(
        ...,
        discriminator="contract_type",
        description="Metadatos extraídos. Los campos varían según el tipo de contrato.",
    )
    red_flags: List[RedFlagAnalysis] = Field(
        default_factory=list,
        description="Listado de riesgos y cláusulas abusivas detectadas.",
    )


# ---------------------------------------------------------------------------
# Structured output schemas (used by pipeline nodes via with_structured_output)
# ---------------------------------------------------------------------------

class ContractClassification(BaseModel):
    contract_type: str = Field(
        ...,
        description="Tipo de contrato. Uno de: alquiler, compraventa, servicios, laboral, nda, unsupported.",
    )


# ---------------------------------------------------------------------------
# Reference data (loaded from data/*.json files)
# ---------------------------------------------------------------------------

class FewShotExample(BaseModel):
    clause_text: str
    matched_red_flag: str
    issue: str
    law_reference: str
    severity: str


class ContractReferenceData(BaseModel):
    type: str
    label: str
    legal_framework: List[str] = Field(default_factory=list)
    common_risk_areas: List[str] = Field(default_factory=list)
    red_flags: List[str] = Field(default_factory=list)
    few_shot_examples: List[FewShotExample] = Field(default_factory=list)


class RedFlagsOutput(BaseModel):
    red_flags: List[RedFlagAnalysis] = Field(
        default_factory=list,
        description="Lista de cláusulas abusivas o de riesgo detectadas en el contrato.",
    )


class SummaryOutput(BaseModel):
    summary: str = Field(
        ...,
        description="Resumen ejecutivo del contrato.",
    )
    overall_risk: SeverityEnum = Field(
        ...,
        description="Nivel de riesgo global: low, medium, high o severe.",
    )


# TypeVar constrained to exactly the schemas structured_completion accepts.
# Using a TypeVar (rather than Union) means:
#   - exactly ONE schema is used per call
#   - the return type is inferred to match the schema passed in
PipelineSchemaT = TypeVar(
    "PipelineSchemaT",
    RedFlagsOutput,
    SummaryOutput,
    AlquilerMetadata,
    CompraventaMetadata,
    LaboralMetadata,
    NdaMetadata,
    ServiciosMetadata,
)
