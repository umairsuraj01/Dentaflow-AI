# evaluator.py — Metrics (IoU, Dice per tooth) for segmentation evaluation.

from __future__ import annotations

import logging

import numpy as np
import torch
import torch.nn.functional as F

from app.constants import AI_NUM_CLASSES
from ai.utils.fdi_numbering import class_to_fdi

logger = logging.getLogger(__name__)


def evaluate_model(
    model: torch.nn.Module,
    dataloader: "torch.utils.data.DataLoader",
    device: str = "cpu",
) -> dict:
    """Evaluate model on a dataset, computing IoU and Dice per class."""
    model.eval()
    all_preds = []
    all_labels = []

    with torch.no_grad():
        for batch_pc, batch_labels in dataloader:
            batch_pc = batch_pc.to(device)
            logits = model(batch_pc)
            preds = logits.argmax(dim=-1).cpu().numpy()
            all_preds.append(preds.flatten())
            all_labels.append(batch_labels.numpy().flatten())

    preds = np.concatenate(all_preds)
    labels = np.concatenate(all_labels)
    return compute_metrics(preds, labels)


def compute_metrics(
    predictions: np.ndarray, ground_truth: np.ndarray,
) -> dict:
    """Compute per-class IoU and Dice, plus mean values."""
    n_classes = AI_NUM_CLASSES
    iou_per_class = {}
    dice_per_class = {}

    for c in range(n_classes):
        pred_c = predictions == c
        gt_c = ground_truth == c
        intersection = (pred_c & gt_c).sum()
        union = (pred_c | gt_c).sum()

        iou = intersection / max(union, 1)
        dice = 2 * intersection / max(pred_c.sum() + gt_c.sum(), 1)

        fdi = class_to_fdi(c)
        if gt_c.sum() > 0:
            iou_per_class[fdi] = round(float(iou), 4)
            dice_per_class[fdi] = round(float(dice), 4)

    valid_ious = [v for v in iou_per_class.values() if v > 0]
    valid_dices = [v for v in dice_per_class.values() if v > 0]

    return {
        "mean_iou": round(np.mean(valid_ious), 4) if valid_ious else 0.0,
        "mean_dice": round(np.mean(valid_dices), 4) if valid_dices else 0.0,
        "iou_per_tooth": iou_per_class,
        "dice_per_tooth": dice_per_class,
        "overall_accuracy": round(
            float((predictions == ground_truth).mean()), 4,
        ),
    }
