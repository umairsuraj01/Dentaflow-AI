# trainer.py — Training loop for MeshSegNet.

from __future__ import annotations

import logging
import time
from pathlib import Path

import torch
from torch.optim import Adam
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader

from ai.models.meshsegnet import MeshSegNet, FocalLoss
from ai.models.model_registry import ModelVersion, register_model
from ai.training.dataset import DentalMeshDataset
from ai.training.evaluator import evaluate_model
from app.constants import AI_NUM_CLASSES

logger = logging.getLogger(__name__)

CHECKPOINT_DIR = Path(__file__).resolve().parent.parent / "checkpoints"


def train_model(
    data_dir: str,
    epochs: int = 100,
    batch_size: int = 4,
    lr: float = 1e-3,
    device: str = "cpu",
    resume_path: str | None = None,
) -> str:
    """Train MeshSegNet and return path to best checkpoint.

    Args:
        data_dir: Directory with meshes/ and labels/ subdirectories
        epochs: Number of training epochs
        batch_size: Batch size
        lr: Learning rate
        device: torch device string
        resume_path: Path to checkpoint to resume from
    """
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    # Data
    train_ds = DentalMeshDataset(f"{data_dir}/train", augment=True)
    val_ds = DentalMeshDataset(f"{data_dir}/val", augment=False)

    if len(train_ds) == 0:
        raise ValueError(f"No training samples found in {data_dir}/train")

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    # Model
    model = MeshSegNet(num_classes=AI_NUM_CLASSES).to(device)
    start_epoch = 0

    if resume_path and Path(resume_path).exists():
        ckpt = torch.load(resume_path, map_location=device)
        model.load_state_dict(ckpt["model_state_dict"])
        start_epoch = ckpt.get("epoch", 0)
        logger.info("Resumed from epoch %d", start_epoch)

    optimizer = Adam(model.parameters(), lr=lr)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs)
    criterion = FocalLoss(gamma=2.0)

    best_dice = 0.0
    best_path = ""

    for epoch in range(start_epoch, epochs):
        # Train
        model.train()
        train_loss = 0.0
        for batch_pc, batch_labels in train_loader:
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
            train_loss += loss.item()

        scheduler.step()
        avg_loss = train_loss / max(len(train_loader), 1)

        # Validate
        if len(val_ds) > 0 and (epoch + 1) % 5 == 0:
            metrics = evaluate_model(model, val_loader, device)
            dice = metrics.get("mean_dice", 0.0)
            logger.info(
                "Epoch %d/%d — loss=%.4f, dice=%.4f",
                epoch + 1, epochs, avg_loss, dice,
            )
            if dice > best_dice:
                best_dice = dice
                best_path = str(CHECKPOINT_DIR / f"meshsegnet_best_{epoch+1}.pth")
                torch.save({
                    "epoch": epoch + 1,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "best_dice": best_dice,
                }, best_path)
        else:
            logger.info("Epoch %d/%d — loss=%.4f", epoch + 1, epochs, avg_loss)

    # Save final
    final_path = str(CHECKPOINT_DIR / "meshsegnet_latest.pth")
    torch.save({
        "epoch": epochs,
        "model_state_dict": model.state_dict(),
        "best_dice": best_dice,
    }, final_path)

    # Register
    register_model(ModelVersion(
        version=f"v{int(time.time())}",
        checkpoint_path=best_path or final_path,
        created_at=time.strftime("%Y-%m-%dT%H:%M:%S"),
        num_classes=AI_NUM_CLASSES,
        training_samples=len(train_ds),
        best_dice=best_dice,
    ))

    logger.info("Training complete. Best dice=%.4f at %s", best_dice, best_path)
    return best_path or final_path
