from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.crud.contract import create_contract, get_contracts, update_contract_status
from app.crud.history import get_history_by_contract
from app.db.session import get_db
from app.services.contract_service import (
    add_history,
    assert_analysed,
    get_contract_or_404,
    read_upload_file,
    run_analysis_background,
)
from app.schemas.contract import (
    ApproveRequest,
    ContractAction,
    ContractActionResponse,
    ContractDetailResponse,
    ContractListItem,
    ContractStatus,
    ContractUploadResponse,
    DenyRequest,
    HealthResponse,
    ModifyRequest,
)

router = APIRouter()


@router.get("/", response_model=list[ContractListItem])
def list_contracts(
    status: ContractStatus | None = None,
    db: Session = Depends(get_db),
):
    return get_contracts(db, status=status)


@router.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", service="contract-risk-analyser")


@router.get("/{contract_id}", response_model=ContractDetailResponse)
def get_contract(
    contract_id: str,
    include_history: bool = False,
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(contract_id, db)
    history = get_history_by_contract(db, contract_id) if include_history else None
    return ContractDetailResponse.model_validate(contract, from_attributes=True).model_copy(
        update={"history": history}
    )


@router.post("/upload", response_model=ContractUploadResponse, status_code=201)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    username: str = Form(...),
    db: Session = Depends(get_db),
):
    text = await read_upload_file(file)
    contract = create_contract(db, filename=file.filename, uploaded_by=username, content=text)
    background_tasks.add_task(run_analysis_background, contract.id)
    return contract


@router.post("/{contract_id}/approve", response_model=ContractActionResponse)
def approve_contract(
    contract_id: str,
    body: ApproveRequest,
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(contract_id, db)
    assert_analysed(contract)
    update_contract_status(db, contract, ContractStatus.approved)
    add_history(db, contract, ContractAction.approve, body.username)
    return contract


@router.post("/{contract_id}/deny", response_model=ContractActionResponse)
def deny_contract(
    contract_id: str,
    body: DenyRequest,
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(contract_id, db)
    assert_analysed(contract)
    update_contract_status(db, contract, ContractStatus.denied)
    add_history(db, contract, ContractAction.deny, body.username)
    return contract


@router.post("/{contract_id}/modify", response_model=ContractActionResponse)
def modify_contract(
    contract_id: str,
    body: ModifyRequest,
    db: Session = Depends(get_db),
):
    contract = get_contract_or_404(contract_id, db)
    assert_analysed(contract)
    update_contract_status(db, contract, ContractStatus.modified)
    add_history(db, contract, ContractAction.modify, body.username, user_feedback=body.feedback)
    return contract
