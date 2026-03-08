# fine_tuner.py — Fine-tune MeshSegNet from technician corrections.

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import torch
from torch.optim import Adam
from torch.utils.data import Dataset, DataLoader

from ai.models.meshsegnet import MeshSegNet, FocalLoss
from ai.models.model_loader import load_model, get_device
from app.constants import AI_NUM_CLASSES

logger = logging.getLogger(__name__)


class CorrectionDataset(Dataset):
    """Dataset built from technician corrections."""

    def __init__(self, corrections: list[dict]) -> None:
        """Each correction dict has 'point_cloud' (N,7) and 'labels' (N,)."""
        self.corrections = corrections

    def __len__(self) -> int:
        return len(self.corrections)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        c = self.corrections[idx]
        pc = torch.from_numpy(c["point_cloud"]).float()
        labels = torch.from_numpy(c["labels"]).long()
        return pc, labels


def fine_tune_from_corrections(
    corrections: list[dict],
    base_checkpoint: str | None = None,
    epochs: int = 10,
    lr: float = 1e-4,
) -> str | None:
    """Fine-tune model using technician correction data.

    Args:
        corrections: List of dicts with point_cloud and labels arrays
        base_checkpoint: Path to base model to fine-tune
        epochs: Fine-tuning epochs (small, to avoid overfitting)
        lr: Lower learning rate for fine-tuning

    Returns:
        Path to fine-tuned checkpoint, or None if no base model.
    """
    if not corrections:
        logger.warning("No corrections provided for fine-tuning")
        return None

    device = get_device()
    model = load_model(base_checkpoint, device=device)
    if model is None:
        logger.warning("No base model to fine-tune")
        return None

    dataset = CorrectionDataset(corrections)
    loader = DataLoader(dataset, batch_size=2, shuffle=True)

    model.train()
    optimizer = Adam(model.parameters(), lr=lr)
    criterion = FocalLoss(gamma=2.0)

    for epoch in range(epochs):
        total_loss = 0.0
        for batch_pc, batch_labels in loader:
            batch_pc = batch_pc.to(device)
            batch_labels = batch_labels.to(device)
            optimizer.zero_grad()
            logits = model(batch_pc)
            loss = criterion(
                logits.reshape(-1, AI_NUM_CLASSES),
                batch_labels.reshape(-1),
            )
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
        logger.info(
            "Fine-tune epoch %d/%d — loss=%.4f",
            epoch + 1, epochs, total_loss / max(len(loader), 1),
        )

    # Save fine-tuned checkpoint
    ckpt_dir = Path(__file__).resolve().parent.parent / "checkpoints"
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    path = str(ckpt_dir / "meshsegnet_finetuned.pth")
    torch.save({"model_state_dict": model.state_dict()}, path)
    logger.info("Fine-tuned model saved to %s", path)
    return path
