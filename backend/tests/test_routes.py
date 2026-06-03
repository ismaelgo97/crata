"""
Endpoint integration tests.

All tests use the in-memory SQLite database and a TestClient with
get_db overridden.  The LLM layer is patched so no external calls
are made.  Background tasks that trigger `run_analysis_pipeline` are
also patched to keep route tests focused on HTTP behaviour.
"""

import io
import json
import uuid
from unittest.mock import patch

import pytest

from app.crud.contract import create_contract, update_contract_status, update_contract_analysis
from app.crud.history import create_history_entry
from app.schemas.contract import ContractAction, ContractStatus
from tests.conftest import CONTRACT_TEXT


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_contract(db_session, status: ContractStatus = ContractStatus.pending):
    contract = create_contract(
        db_session,
        filename="test_contrato.txt",
        uploaded_by="testuser",
        content=CONTRACT_TEXT,
    )
    if status != ContractStatus.pending:
        update_contract_status(db_session, contract, status)
    return contract


def _make_analysed_contract(db_session):
    contract = _make_contract(db_session)
    analysis = json.dumps({
        "unsupported": False,
        "contract_type": "laboral",
        "overall_risk": "high",
        "summary": "Contrato con cláusulas de riesgo.",
        "metadata": {"contract_type": "laboral", "parties": ["Empresa Test S.L.", "Juan García"]},
        "red_flags": [{"clause_quote": "...", "issue": "Riesgo", "law_reference": "Art. 1 ET", "severity": "high"}],
    })
    update_contract_analysis(
        db_session,
        contract,
        status=ContractStatus.analysed,
        contract_type="laboral",
        overall_risk="high",
        analysis_result=analysis,
    )
    return contract


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

class TestHealth:
    def test_returns_ok(self, client):
        resp = client.get("/api/v1/contracts/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "service": "contract-risk-analyser"}


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

class TestListContracts:
    def test_empty_list(self, client):
        resp = client.get("/api/v1/contracts/")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_all_contracts(self, client, db_session):
        _make_contract(db_session)
        _make_contract(db_session)
        resp = client.get("/api/v1/contracts/")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_status(self, client, db_session):
        _make_contract(db_session, ContractStatus.pending)
        _make_analysed_contract(db_session)
        resp = client.get("/api/v1/contracts/?status=analysed")
        data = resp.json()
        assert resp.status_code == 200
        assert len(data) == 1
        assert data[0]["status"] == "analysed"

    def test_response_shape(self, client, db_session):
        _make_contract(db_session)
        data = client.get("/api/v1/contracts/").json()
        item = data[0]
        assert "contract_id" in item
        assert "filename" in item
        assert "status" in item
        assert "overall_risk" in item
        assert "uploaded_by" in item
        # content and analysis_result must NOT be in the list response
        assert "content" not in item
        assert "analysis_result" not in item


# ---------------------------------------------------------------------------
# POST /upload
# ---------------------------------------------------------------------------

class TestUploadContract:
    def _upload(self, client, content=CONTRACT_TEXT, content_type="text/plain", filename="contrato.txt", username="testuser"):
        return client.post(
            "/api/v1/contracts/upload",
            files={"file": (filename, io.BytesIO(content.encode()), content_type)},
            data={"username": username},
        )

    def test_upload_creates_pending_contract(self, client, db_session):
        with patch("app.services.contract_service.run_analysis_pipeline"):
            resp = self._upload(client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "pending"
        assert data["filename"] == "contrato.txt"
        assert data["uploaded_by"] == "testuser"
        assert "contract_id" in data

    def test_upload_unsupported_content_type(self, client):
        resp = self._upload(client, content_type="application/pdf")
        assert resp.status_code == 415

    def test_upload_markdown_accepted(self, client):
        with patch("app.services.contract_service.run_analysis_pipeline"):
            resp = self._upload(client, content_type="text/markdown", filename="contrato.md")
        assert resp.status_code == 201

    def test_upload_non_utf8_rejected(self, client):
        resp = client.post(
            "/api/v1/contracts/upload",
            files={"file": ("contrato.txt", io.BytesIO(b"\xff\xfe invalid bytes"), "text/plain")},
            data={"username": "testuser"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /{contract_id}
# ---------------------------------------------------------------------------

class TestGetContract:
    def test_returns_contract(self, client, db_session):
        contract = _make_contract(db_session)
        resp = client.get(f"/api/v1/contracts/{contract.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["contract_id"] == contract.id
        assert data["content"] == CONTRACT_TEXT

    def test_not_found(self, client):
        resp = client.get(f"/api/v1/contracts/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_without_history_by_default(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        create_history_entry(db_session, contract, ContractAction.analyse, "LLM")
        resp = client.get(f"/api/v1/contracts/{contract.id}")
        assert resp.status_code == 200
        assert resp.json().get("history") is None

    def test_with_history(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        create_history_entry(db_session, contract, ContractAction.analyse, "LLM", ai_output='{"summary":"test"}')
        resp = client.get(f"/api/v1/contracts/{contract.id}?include_history=true")
        assert resp.status_code == 200
        history = resp.json()["history"]
        assert isinstance(history, list)
        assert len(history) == 1
        assert history[0]["action"] == "ANALYSE"
        assert history[0]["username"] == "LLM"

    def test_history_ordered_newest_first(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        create_history_entry(db_session, contract, ContractAction.analyse, "LLM")
        update_contract_status(db_session, contract, ContractStatus.approved)
        create_history_entry(db_session, contract, ContractAction.approve, "reviewer")
        resp = client.get(f"/api/v1/contracts/{contract.id}?include_history=true")
        history = resp.json()["history"]
        assert history[0]["action"] == "ANALYSE"
        assert history[1]["action"] == "APPROVE"


# ---------------------------------------------------------------------------
# POST /{contract_id}/approve
# ---------------------------------------------------------------------------

class TestApproveContract:
    def test_approve_analysed_contract(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/approve",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "approved"

    def test_approve_pending_contract_rejected(self, client, db_session):
        contract = _make_contract(db_session, ContractStatus.pending)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/approve",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 409

    def test_approve_already_approved_rejected(self, client, db_session):
        contract = _make_contract(db_session, ContractStatus.approved)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/approve",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 409

    def test_approve_not_found(self, client):
        resp = client.post(f"/api/v1/contracts/{uuid.uuid4()}/approve", json={"username": "reviewer"})
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /{contract_id}/deny
# ---------------------------------------------------------------------------

class TestDenyContract:
    def test_deny_analysed_contract(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/deny",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "denied"

    def test_deny_pending_rejected(self, client, db_session):
        contract = _make_contract(db_session, ContractStatus.pending)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/deny",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 409

    def test_deny_approved_contract_rejected(self, client, db_session):
        contract = _make_contract(db_session, ContractStatus.approved)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/deny",
            json={"username": "reviewer"},
        )
        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# POST /{contract_id}/modify
# ---------------------------------------------------------------------------

class TestModifyContract:
    def test_modify_analysed_contract(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/modify",
            json={"username": "reviewer", "feedback": "Revisar cláusula 3."},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "modified"

    def test_modify_creates_history_with_feedback(self, client, db_session):
        contract = _make_analysed_contract(db_session)
        client.post(
            f"/api/v1/contracts/{contract.id}/modify",
            json={"username": "reviewer", "feedback": "Revisar cláusula 3."},
        )
        resp = client.get(f"/api/v1/contracts/{contract.id}?include_history=true")
        history = resp.json()["history"]
        assert history[0]["action"] == "MODIFY"
        assert history[0]["user_feedback"] == "Revisar cláusula 3."

    def test_modify_pending_rejected(self, client, db_session):
        contract = _make_contract(db_session, ContractStatus.pending)
        resp = client.post(
            f"/api/v1/contracts/{contract.id}/modify",
            json={"username": "reviewer", "feedback": "Cambios requeridos."},
        )
        assert resp.status_code == 409
