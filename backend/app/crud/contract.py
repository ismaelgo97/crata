import uuid

from sqlalchemy.orm import Session

from app.db.models import Contract
from app.schemas.contract import ContractStatus


def get_contract(db: Session, contract_id: str) -> Contract | None:
    return db.query(Contract).filter(Contract.id == contract_id).first()


def get_contracts(db: Session, status: ContractStatus | None = None) -> list[Contract]:
    query = db.query(Contract)
    if status:
        query = query.filter(Contract.status == status)
    return query.order_by(Contract.created_at.desc()).all()


def create_contract(
    db: Session,
    filename: str,
    uploaded_by: str,
    content: str,
) -> Contract:
    contract = Contract(
        id=str(uuid.uuid4()),
        filename=filename,
        status=ContractStatus.pending,
        uploaded_by=uploaded_by,
        content=content,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


def update_contract_analysis(
    db: Session,
    contract: Contract,
    status: ContractStatus,
    contract_type: str | None = None,
    overall_risk: str | None = None,
    analysis_result: str | None = None,
) -> Contract:
    contract.status = status
    contract.contract_type = contract_type
    contract.overall_risk = overall_risk
    contract.analysis_result = analysis_result
    db.commit()
    db.refresh(contract)
    return contract


def update_contract_status(db: Session, contract: Contract, status: ContractStatus) -> Contract:
    contract.status = status
    db.commit()
    db.refresh(contract)
    return contract
