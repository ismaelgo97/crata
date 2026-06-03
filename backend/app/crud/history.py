import uuid

from sqlalchemy.orm import Session

from app.db.models import Contract, ContractHistory
from app.schemas.contract import ContractAction


def create_history_entry(
    db: Session,
    contract: Contract,
    action: ContractAction,
    username: str,
    user_feedback: str | None = None,
    ai_output: str | None = None,
) -> ContractHistory:
    entry = ContractHistory(
        id=str(uuid.uuid4()),
        contract_id=contract.id,
        username=username,
        action=action,
        user_feedback=user_feedback,
        ai_output=ai_output,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_history_by_contract(db: Session, contract_id: str) -> list[ContractHistory]:
    return (
        db.query(ContractHistory)
        .filter(ContractHistory.contract_id == contract_id)
        .order_by(ContractHistory.created_at.desc())
        .all()
    )
