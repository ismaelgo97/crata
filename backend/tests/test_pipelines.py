"""
Pipeline unit and integration tests.

Nodes are tested in isolation by calling them directly with a
minimal PipelineState dict.  The full pipeline is tested via
run_analysis_pipeline with both LLM functions patched so no
external API calls are made.
"""

from unittest.mock import patch

import pytest

from app.schemas.ai_models import (
    AlquilerMetadata,
    LaboralMetadata,
    NdaMetadata,
    RedFlagAnalysis,
    RedFlagsOutput,
    SeverityEnum,
    SummaryOutput,
)
from app.schemas.contract import ContractTypes
from app.services.ai_pipelines import (
    _analyse_red_flags,
    _classify,
    _extract_metadata,
    _summarise,
    run_analysis_pipeline,
)
from tests.conftest import (
    CONTRACT_TEXT,
    _DEFAULT_METADATA,
    _DEFAULT_RED_FLAGS,
    _DEFAULT_SUMMARY,
    _structured_side_effect,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_state(**overrides):
    """Return a minimal PipelineState dict with sensible defaults."""
    state = {
        "contract_text": CONTRACT_TEXT,
        "contract_type": None,
        "metadata": None,
        "red_flags": [],
        "summary": None,
        "overall_risk": None,
        "unsupported": False,
    }
    state.update(overrides)
    return state


# ---------------------------------------------------------------------------
# _classify node
# ---------------------------------------------------------------------------

class TestClassifyNode:
    def test_supported_type_returned_as_enum(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="laboral"):
            result = _classify(_base_state())
        assert result["contract_type"] == ContractTypes.laboral
        assert result["unsupported"] is False

    def test_all_supported_types_recognised(self):
        for type_value in ["alquiler", "compraventa", "servicios", "laboral", "nda"]:
            with patch("app.services.ai_pipelines.chat_completion", return_value=type_value):
                result = _classify(_base_state())
            assert result["contract_type"].value == type_value
            assert result["unsupported"] is False

    def test_unknown_value_becomes_unsupported(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="factura"):
            result = _classify(_base_state())
        assert result["contract_type"] == ContractTypes.unsupported
        assert result["unsupported"] is True

    def test_empty_response_becomes_unsupported(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value=""):
            result = _classify(_base_state())
        assert result["unsupported"] is True

    def test_extra_whitespace_stripped(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="  nda  \n"):
            result = _classify(_base_state())
        assert result["contract_type"] == ContractTypes.nda
        assert result["unsupported"] is False

    def test_only_first_3000_chars_sent_to_model(self):
        long_text = "x" * 5000
        captured = []

        def capture(messages, model):
            captured.append(messages[1]["content"])
            return "laboral"

        with patch("app.services.ai_pipelines.chat_completion", side_effect=capture):
            _classify(_base_state(contract_text=long_text))

        assert len(captured[0]) <= 3000 + len("Clasifica el siguiente documento:\n\n")


# ---------------------------------------------------------------------------
# _extract_metadata node
# ---------------------------------------------------------------------------

class TestExtractMetadataNode:
    def test_returns_metadata_dict_in_state(self):
        with patch(
            "app.services.ai_pipelines.structured_completion",
            return_value=_DEFAULT_METADATA,
        ):
            result = _extract_metadata(_base_state(contract_type=ContractTypes.laboral))
        assert isinstance(result["metadata"], LaboralMetadata)
        assert result["metadata"].annual_gross_salary == 32000.0

    def test_uses_correct_schema_for_type(self):
        captured_schema = []

        def capture(messages, model, schema):
            captured_schema.append(schema)
            return AlquilerMetadata(
                contract_type="alquiler",
                parties=["Arrendador", "Arrendatario"],
                rent_amount=900.0,
            )

        with patch("app.services.ai_pipelines.structured_completion", side_effect=capture):
            _extract_metadata(_base_state(contract_type=ContractTypes.alquiler))

        assert captured_schema[0] is AlquilerMetadata


# ---------------------------------------------------------------------------
# _analyse_red_flags node
# ---------------------------------------------------------------------------

class TestAnalyseRedFlagsNode:
    def _state_with_metadata(self):
        return _base_state(
            contract_type=ContractTypes.laboral,
            metadata=_DEFAULT_METADATA,
        )

    def test_ai_flags_included_in_output(self):
        with patch("app.services.ai_pipelines.structured_completion", return_value=_DEFAULT_RED_FLAGS):
            result = _analyse_red_flags(self._state_with_metadata())
        assert len(result["red_flags"]) >= 1
        assert all(isinstance(f, RedFlagAnalysis) for f in result["red_flags"])

    def test_missing_critical_field_adds_programmatic_flag(self):
        # annual_gross_salary is None → should produce a missing-field flag
        metadata_without_salary = LaboralMetadata(
            contract_type="laboral",
            parties=["Empresa", "Trabajador"],
            annual_gross_salary=None,
        )
        empty_flags = RedFlagsOutput(red_flags=[])

        with patch("app.services.ai_pipelines.structured_completion", return_value=empty_flags):
            result = _analyse_red_flags(_base_state(
                contract_type=ContractTypes.laboral,
                metadata=metadata_without_salary,
            ))

        missing = [f for f in result["red_flags"] if "[Campo no encontrado" in f.clause_quote]
        assert len(missing) == 1
        assert "Art. 26.1 del ET" in missing[0].law_reference

    def test_no_programmatic_flag_when_field_present(self):
        empty_flags = RedFlagsOutput(red_flags=[])
        with patch("app.services.ai_pipelines.structured_completion", return_value=empty_flags):
            result = _analyse_red_flags(self._state_with_metadata())
        missing = [f for f in result["red_flags"] if "[Campo no encontrado" in f.clause_quote]
        assert len(missing) == 0


# ---------------------------------------------------------------------------
# _summarise node
# ---------------------------------------------------------------------------

class TestSummariseNode:
    def _state_with_flags(self):
        return _base_state(
            contract_type=ContractTypes.laboral,
            metadata=_DEFAULT_METADATA,
            red_flags=_DEFAULT_RED_FLAGS.red_flags,
        )

    def test_summary_and_risk_in_output(self):
        with patch("app.services.ai_pipelines.structured_completion", return_value=_DEFAULT_SUMMARY):
            result = _summarise(self._state_with_flags())
        assert result["summary"] == _DEFAULT_SUMMARY.summary
        assert result["overall_risk"] == SeverityEnum.high

    def test_overall_risk_is_severity_enum(self):
        with patch("app.services.ai_pipelines.structured_completion", return_value=_DEFAULT_SUMMARY):
            result = _summarise(self._state_with_flags())
        assert isinstance(result["overall_risk"], SeverityEnum)


# ---------------------------------------------------------------------------
# run_analysis_pipeline (full pipeline)
# ---------------------------------------------------------------------------

class TestRunAnalysisPipeline:
    def test_unsupported_document_fast_fails(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="not_a_contract"):
            result = run_analysis_pipeline("Esta es una factura.")
        assert result["unsupported"] is True
        assert result["contract_type"] == "unsupported"
        assert "message" in result

    def test_unsupported_does_not_call_structured_completion(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="invoice"), \
             patch("app.services.ai_pipelines.structured_completion") as mock_sc:
            run_analysis_pipeline("Factura número 123.")
        mock_sc.assert_not_called()

    def test_happy_path_returns_full_result(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="laboral"), \
             patch("app.services.ai_pipelines.structured_completion", side_effect=_structured_side_effect):
            result = run_analysis_pipeline(CONTRACT_TEXT)

        assert result["unsupported"] is False
        assert result["contract_type"] == "laboral"
        assert isinstance(result["metadata"], dict)
        assert result["metadata"]["annual_gross_salary"] == 32000.0
        assert isinstance(result["red_flags"], list)
        assert len(result["red_flags"]) >= 1
        assert result["overall_risk"] == "high"
        assert isinstance(result["summary"], str)

    def test_happy_path_red_flags_are_serialised_dicts(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="laboral"), \
             patch("app.services.ai_pipelines.structured_completion", side_effect=_structured_side_effect):
            result = run_analysis_pipeline(CONTRACT_TEXT)

        for flag in result["red_flags"]:
            assert isinstance(flag, dict)
            assert "clause_quote" in flag
            assert "severity" in flag

    def test_structured_completion_called_three_times_for_supported(self):
        with patch("app.services.ai_pipelines.chat_completion", return_value="laboral"), \
             patch("app.services.ai_pipelines.structured_completion", side_effect=_structured_side_effect) as mock_sc:
            run_analysis_pipeline(CONTRACT_TEXT)
        # extraction + red_flags + summary
        assert mock_sc.call_count == 3
