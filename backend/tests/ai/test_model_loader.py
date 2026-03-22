# test_model_loader.py — Unit tests for model loading and caching.

import pytest
import torch

from ai.models.model_loader import (
    load_model,
    clear_cache,
    get_device,
    UPPER_CHECKPOINT,
    LOWER_CHECKPOINT,
)
from ai.models.meshsegnet import MeshSegNet


class TestGetDevice:
    def test_returns_string(self):
        device = get_device()
        assert isinstance(device, str)

    def test_valid_device(self):
        device = get_device()
        assert device in ("cpu", "cuda", "mps")


class TestCheckpoints:
    def test_upper_checkpoint_exists(self):
        assert UPPER_CHECKPOINT.exists(), f"Missing: {UPPER_CHECKPOINT}"

    def test_lower_checkpoint_exists(self):
        assert LOWER_CHECKPOINT.exists(), f"Missing: {LOWER_CHECKPOINT}"

    def test_checkpoints_are_files(self):
        assert UPPER_CHECKPOINT.is_file()
        assert LOWER_CHECKPOINT.is_file()

    def test_checkpoints_not_empty(self):
        assert UPPER_CHECKPOINT.stat().st_size > 1_000_000  # >1MB
        assert LOWER_CHECKPOINT.stat().st_size > 1_000_000


class TestLoadModel:
    @pytest.fixture(autouse=True)
    def _clear(self):
        clear_cache()
        yield
        clear_cache()

    def test_load_upper(self):
        model = load_model(jaw="upper", device="cpu")
        assert model is not None
        assert isinstance(model, MeshSegNet)

    def test_load_lower(self):
        model = load_model(jaw="lower", device="cpu")
        assert model is not None
        assert isinstance(model, MeshSegNet)

    def test_model_in_eval_mode(self):
        model = load_model(jaw="upper", device="cpu")
        assert not model.training

    def test_model_num_classes(self):
        model = load_model(jaw="upper", device="cpu")
        assert model.num_classes == 15

    def test_model_num_channels(self):
        model = load_model(jaw="upper", device="cpu")
        assert model.num_channels == 15

    def test_cache_returns_same_model(self):
        model1 = load_model(jaw="upper", device="cpu")
        model2 = load_model(jaw="upper", device="cpu")
        assert model1 is model2

    def test_different_jaws_different_models(self):
        upper = load_model(jaw="upper", device="cpu")
        lower = load_model(jaw="lower", device="cpu")
        assert upper is not lower

    def test_clear_cache(self):
        model1 = load_model(jaw="upper", device="cpu")
        clear_cache()
        model2 = load_model(jaw="upper", device="cpu")
        assert model1 is not model2


class TestModelForwardPass:
    """Test that loaded models produce correct output shapes."""

    @pytest.fixture
    def upper_model(self):
        clear_cache()
        return load_model(jaw="upper", device="cpu")

    @pytest.fixture
    def lower_model(self):
        clear_cache()
        return load_model(jaw="lower", device="cpu")

    def test_output_shape(self, upper_model):
        N = 200
        X = torch.randn(1, 15, N)
        A_S = torch.eye(N).unsqueeze(0)
        A_L = torch.eye(N).unsqueeze(0)
        with torch.no_grad():
            out = upper_model(X, A_S, A_L)
        assert out.shape == (1, N, 15)

    def test_output_is_probability(self, upper_model):
        N = 100
        X = torch.randn(1, 15, N)
        A_S = torch.eye(N).unsqueeze(0)
        A_L = torch.eye(N).unsqueeze(0)
        with torch.no_grad():
            out = upper_model(X, A_S, A_L)
        # Each row should sum to ~1 (softmax output)
        row_sums = out[0].sum(dim=1)
        assert torch.allclose(row_sums, torch.ones(N), atol=1e-4)

    def test_output_non_negative(self, upper_model):
        N = 100
        X = torch.randn(1, 15, N)
        A_S = torch.eye(N).unsqueeze(0)
        A_L = torch.eye(N).unsqueeze(0)
        with torch.no_grad():
            out = upper_model(X, A_S, A_L)
        assert (out >= 0).all()

    def test_lower_model_works(self, lower_model):
        N = 150
        X = torch.randn(1, 15, N)
        A_S = torch.eye(N).unsqueeze(0)
        A_L = torch.eye(N).unsqueeze(0)
        with torch.no_grad():
            out = lower_model(X, A_S, A_L)
        assert out.shape == (1, N, 15)
