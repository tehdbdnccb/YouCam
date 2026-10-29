# backend/test_suite.py
import asyncio
import base64
import io
from unittest.mock import AsyncMock, MagicMock, patch

import numpy as np
import pytest
from PIL import Image

from app.tools import (
    ApparelSynthesisService,
    ChromaticNormalizer,
    PhysiologicalDiagnosticService,
    SessionVault,
    YouCamAsyncTransport,
)


def _create_synthetic_b64_image(rgb_tuple: tuple[int, int, int] = (220, 140, 130)) -> str:
    """Helper to generate a valid 64x64 JPEG encoded as Base64."""
    img = Image.new("RGB", (64, 64), color=rgb_tuple)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


class TestChromaticInvariance:
    """
    Verifies Gray-World Von Kries white-balance invariance and Vasomotor Index math.
    Strictly 2 methods.
    """

    def test_von_kries_neutralizes_warm_illuminant(self) -> None:
        # Simulate warm 2700K tungsten bias (elevated Red=210, depressed Blue=110)
        biased_tensor = np.full((32, 32, 3), [210.0, 160.0, 110.0], dtype=np.float32)
        balanced = ChromaticNormalizer._apply_von_kries_gain(biased_tensor)
        channel_means = np.mean(balanced, axis=(0, 1))
        # Red channel must scale down toward gray mean (160.0); Blue must scale up
        assert channel_means[0] < 180.0
        assert channel_means[2] > 140.0

    def test_vasomotor_index_triggers_cool_spectrum_gate(self) -> None:
        raw_scores = {"redness": {"ui_score": 15}, "moisture": {"ui_score": 30}}
        metrics = PhysiologicalDiagnosticService._compute_vasomotor_metrics(raw_scores)
        # E_norm = 85.0, D_norm = 70.0 -> V_index = 0.72(85) + 0.28(70) = 80.8
        assert metrics["vasomotor_index"] == 80.8
        assert metrics["vasomotor_flare_detected"] is True
        assert "SKU-CORAL-KNIT-03" not in metrics["allowed_skus"]


class TestSecurityBoundaries:
    """
    Verifies Claim-Check memory ceilings and SSRF SKU catalog whitelisting.
    Strictly 2 methods.
    """

    def test_payload_size_and_claim_check_isolation(self) -> None:
        valid_b64 = _create_synthetic_b64_image()
        session_id = SessionVault.check_in(valid_b64)
        assert len(session_id) == 36
        # Verify >6MB payload triggers immediate fail-fast ValueError
        oversized_b64 = "A" * (9 * 1024 * 1024)
        with pytest.raises(ValueError, match="exceeds 6MB security boundary"):
            SessionVault.check_in(oversized_b64)

    def test_ssrf_whitelist_rejects_untrusted_sku(self) -> None:
        valid_meta = ApparelSynthesisService._resolve_whitelisted_sku("SKU-SAGE-LINEN-01")
        assert valid_meta["category"] == "upper_body"
        with pytest.raises(ValueError, match="SSRF Guard"):
            ApparelSynthesisService._resolve_whitelisted_sku("http://169.254.169.254/latest/meta-data")


class TestAsyncCircuitBreaker:
    """
    Verifies SHA-256 content-addressable VTO caching and async polling timeouts.
    Strictly 2 methods.
    """


    def test_vto_sha256_cache_eliminates_duplicate_io(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("USE_MOCK_API", "True")
        session_id = SessionVault.check_in(_create_synthetic_b64_image())
        first_call = asyncio.run(ApparelSynthesisService.render_vto(session_id, "SKU-SAGE-LINEN-01"))
        second_call = asyncio.run(ApparelSynthesisService.render_vto(session_id, "SKU-SAGE-LINEN-01"))
        assert first_call["cache_hit"] is False
        assert second_call["cache_hit"] is True


    @patch("app.tools.asyncio.sleep", new_callable=AsyncMock)
    @patch("app.tools.httpx.AsyncClient")
    def test_transport_polling_timeout_trips_breaker(
        self, mock_client_cls: MagicMock, _mock_sleep: AsyncMock
    ) -> None:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        post_resp = MagicMock()
        post_resp.json.return_value = {"result": {"task_id": "task-999"}}
        mock_client.post.return_value = post_resp

        poll_resp = MagicMock()
        poll_resp.json.return_value = {"result": {"task_status": "running"}}
        mock_client.get.return_value = poll_resp

        transport = YouCamAsyncTransport()
        with pytest.raises(TimeoutError, match="exceeded 10s polling circuit breaker"):
            asyncio.run(transport.execute_task("/s2s/v2.0/task/cloth", {"src_file_b64": "YWI="}))