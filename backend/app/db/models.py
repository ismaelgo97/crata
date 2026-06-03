from sqlalchemy import Column, String, Text, DateTime, Enum, ForeignKey, func
from sqlalchemy.orm import DeclarativeBase, relationship

from app.schemas.contract import ContractAction, ContractStatus


class Base(DeclarativeBase):
    pass


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(String, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    contract_type = Column(String, nullable=True)
    status = Column(Enum(ContractStatus), default=ContractStatus.pending)
    uploaded_by = Column(String, nullable=True)
    content = Column(Text, nullable=True)           # raw contract text, required for analysis
    overall_risk = Column(String, nullable=True)    # low | medium | high | severe
    analysis_result = Column(Text, nullable=True)  # JSON blob
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    history = relationship("ContractHistory", back_populates="contract", cascade="all, delete-orphan")


class ContractHistory(Base):
    __tablename__ = "contract_history"

    id = Column(String, primary_key=True, index=True)
    contract_id = Column(String, ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True)
    username = Column(String, nullable=True)
    action = Column(Enum(ContractAction), nullable=True)
    user_feedback = Column(Text, nullable=True)
    ai_output = Column(Text, nullable=True)         # JSON blob with analysis result
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    contract = relationship("Contract", back_populates="history")
