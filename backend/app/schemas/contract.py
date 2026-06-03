import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ContractStatus(str, enum.Enum):
    pending = "pending"
    analysing = "analysing"
    analysed = "analysed"
    unsupported = "unsupported"
    approved = "approved"
    denied = "denied"
    modified = "modified"


class ContractAction(str, enum.Enum):
    analyse = "ANALYSE"
    approve = "APPROVE"
    deny = "DENY"
    modify = "MODIFY"


class ContractSupportedTypes(str, enum.Enum):
    alquiler = "alquiler"
    compraventa = "compraventa"
    servicios = "servicios"
    laboral = "laboral"
    nda = "nda"


class ContractTypes(str, enum.Enum):
    alquiler = "alquiler"
    compraventa = "compraventa"
    servicios = "servicios"
    laboral = "laboral"
    nda = "nda"
    unsupported = "unsupported"


class AllowedContentType(str, enum.Enum):
    text_plain = "text/plain"
    text_markdown = "text/markdown"
    text_x_markdown = "text/x-markdown"


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------

class CommonRequest(BaseModel):
    username: str


class ApproveRequest(CommonRequest):
    pass


class DenyRequest(CommonRequest):
    pass


class ModifyRequest(CommonRequest):
    feedback: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    service: str


class ContractListItem(BaseModel):
    contract_id: str = Field(validation_alias="id")
    filename: str
    contract_type: Optional[str]
    status: ContractStatus
    overall_risk: Optional[str]
    uploaded_by: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    model_config = {"from_attributes": True, "populate_by_name": True}


class HistoryEntryResponse(BaseModel):
    id: str
    username: Optional[str]
    action: Optional[ContractAction]
    user_feedback: Optional[str]
    ai_output: Optional[str]
    created_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ContractDetailResponse(BaseModel):
    contract_id: str = Field(validation_alias="id")
    filename: str
    contract_type: Optional[str]
    status: ContractStatus
    uploaded_by: Optional[str]
    content: Optional[str]
    analysis_result: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    history: Optional[list[HistoryEntryResponse]] = None

    model_config = {"from_attributes": True, "populate_by_name": True}


class ContractUploadResponse(BaseModel):
    contract_id: str = Field(validation_alias="id")
    filename: str
    uploaded_by: Optional[str]
    status: ContractStatus
    created_at: Optional[datetime]

    model_config = {"from_attributes": True, "populate_by_name": True}


class ContractActionResponse(BaseModel):
    contract_id: str = Field(validation_alias="id")
    status: ContractStatus

    model_config = {"from_attributes": True, "populate_by_name": True}
