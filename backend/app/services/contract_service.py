import json

from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.crud.contract import get_contract, update_contract_analysis
from app.crud.history import create_history_entry
from app.db.models import Contract, ContractHistory
from app.db.session import SessionLocal
from app.schemas.contract import AllowedContentType, ContractAction, ContractStatus
from app.services.ai_pipelines import run_analysis_pipeline


ALLOWED_CONTENT_TYPES = {t.value for t in AllowedContentType}


async def read_upload_file(file: UploadFile) -> str:
    """Validate content type and decode the uploaded file as UTF-8 text."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: plain text and markdown.",
        )
    content = await file.read()
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=422, detail="File could not be decoded as UTF-8.")


def get_contract_or_404(contract_id: str, db: Session) -> Contract:
    contract = get_contract(db, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found.")
    return contract


def assert_analysed(contract: Contract) -> None:
    if contract.status != ContractStatus.analysed:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Action not allowed. Contract must be in '{ContractStatus.analysed}' status "
                f"but is currently '{contract.status}'."
            ),
        )


def add_history(
    db: Session,
    contract: Contract,
    action: ContractAction,
    username: str,
    user_feedback: str | None = None,
) -> ContractHistory:
    return create_history_entry(db, contract, action, username, user_feedback=user_feedback)


def run_analysis_background(contract_id: str) -> None:
    """Background task: fetch contract content, run the AI pipeline, persist results."""
    db = SessionLocal()
    try:
        contract = get_contract(db, contract_id)
        if not contract or not contract.content:
            return

        result = run_analysis_pipeline(contract.content)

        if result.get("unsupported"):
            update_contract_analysis(
                db, contract,
                status=ContractStatus.unsupported,
                contract_type="unsupported",
            )
        else:
            update_contract_analysis(
                db, contract,
                status=ContractStatus.analysed,
                contract_type=result.get("contract_type"),
                overall_risk=result.get("overall_risk"),
                analysis_result=json.dumps(result, ensure_ascii=False),
            )

        create_history_entry(
            db, contract,
            action=ContractAction.analyse,
            username="LLM",
            ai_output=json.dumps(result, ensure_ascii=False),
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
