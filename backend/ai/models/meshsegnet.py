# meshsegnet.py — MeshSegNet PyTorch architecture for dental tooth segmentation.

from __future__ import annotations

import logging

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from app.constants import AI_NUM_CLASSES, AI_POINT_CLOUD_SIZE

logger = logging.getLogger(__name__)


class STN3d(nn.Module):
    """Spatial Transformer Network for 3D point alignment."""

    def __init__(self) -> None:
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Conv1d(3, 64, 1), nn.BatchNorm1d(64), nn.ReLU(),
            nn.Conv1d(64, 128, 1), nn.BatchNorm1d(128), nn.ReLU(),
            nn.Conv1d(128, 1024, 1), nn.BatchNorm1d(1024), nn.ReLU(),
        )
        self.fc = nn.Sequential(
            nn.Linear(1024, 512), nn.BatchNorm1d(512), nn.ReLU(),
            nn.Linear(512, 256), nn.BatchNorm1d(256), nn.ReLU(),
            nn.Linear(256, 9),
        )
        # Initialize as identity transform
        self.fc[-1].weight.data.zero_()
        self.fc[-1].bias.data.copy_(
            torch.tensor([1, 0, 0, 0, 1, 0, 0, 0, 1], dtype=torch.float32)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Predict 3x3 transformation matrix. Input: (B, 3, N)."""
        feat = self.mlp(x)
        feat = feat.max(dim=2)[0]
        transform = self.fc(feat)
        return transform.view(-1, 3, 3)


class LocalFeatureEncoder(nn.Module):
    """1D Conv encoder producing per-point local features."""

    def __init__(self, in_channels: int = 7) -> None:
        super().__init__()
        self.conv1 = nn.Sequential(
            nn.Conv1d(in_channels, 64, 1), nn.BatchNorm1d(64), nn.ReLU(),
        )
        self.conv2 = nn.Sequential(
            nn.Conv1d(64, 128, 1), nn.BatchNorm1d(128), nn.ReLU(),
        )
        self.conv3 = nn.Sequential(
            nn.Conv1d(128, 128, 1), nn.BatchNorm1d(128), nn.ReLU(),
        )
        self.conv4 = nn.Sequential(
            nn.Conv1d(128, 256, 1), nn.BatchNorm1d(256), nn.ReLU(),
        )
        self.conv5 = nn.Sequential(
            nn.Conv1d(256, 1024, 1), nn.BatchNorm1d(1024), nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Return (local_features_256, deep_features_1024). Input: (B, 7, N)."""
        x = self.conv1(x)
        x = self.conv2(x)
        x = self.conv3(x)
        local_feat = self.conv4(x)   # (B, 256, N)
        deep_feat = self.conv5(local_feat)  # (B, 1024, N)
        return local_feat, deep_feat


class SegmentationHead(nn.Module):
    """MLP segmentation head: 1280 -> num_classes per point."""

    def __init__(self, num_classes: int = AI_NUM_CLASSES) -> None:
        super().__init__()
        self.mlp = nn.Sequential(
            nn.Conv1d(1280, 512, 1), nn.BatchNorm1d(512), nn.ReLU(),
            nn.Dropout(0.3),
            nn.Conv1d(512, 256, 1), nn.BatchNorm1d(256), nn.ReLU(),
            nn.Dropout(0.3),
            nn.Conv1d(256, 128, 1), nn.BatchNorm1d(128), nn.ReLU(),
            nn.Conv1d(128, num_classes, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Per-point class logits. Input: (B, 1280, N), Output: (B, C, N)."""
        return self.mlp(x)


class MeshSegNet(nn.Module):
    """MeshSegNet — Point-cloud dental tooth segmentation network.

    Input: (B, N, 7) — XYZ (3) + normals (3) + curvature (1)
    Output: (B, N, num_classes) — per-point class probabilities
    """

    def __init__(self, num_classes: int = AI_NUM_CLASSES) -> None:
        super().__init__()
        self.num_classes = num_classes
        self.stn = STN3d()
        self.encoder = LocalFeatureEncoder(in_channels=7)
        self.seg_head = SegmentationHead(num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass. Input: (B, N, 7), Output: (B, N, num_classes)."""
        batch_size, n_points, _ = x.shape
        xyz = x[:, :, :3].transpose(1, 2)    # (B, 3, N)

        # Spatial transformer on XYZ
        transform = self.stn(xyz)             # (B, 3, 3)
        xyz_aligned = torch.bmm(transform, xyz)  # (B, 3, N)

        # Replace XYZ with aligned XYZ, keep normals + curvature
        features = x.transpose(1, 2).clone()  # (B, 7, N)
        features[:, :3, :] = xyz_aligned

        # Encode local features
        local_feat, deep_feat = self.encoder(features)  # (B,256,N), (B,1024,N)

        # Global max pooling
        global_feat = deep_feat.max(dim=2, keepdim=True)[0]  # (B, 1024, 1)
        global_feat = global_feat.expand(-1, -1, n_points)   # (B, 1024, N)

        # Concatenate local + global
        combined = torch.cat([local_feat, global_feat], dim=1)  # (B, 1280, N)

        # Segmentation head
        logits = self.seg_head(combined)  # (B, C, N)
        return logits.transpose(1, 2)     # (B, N, C)

    def inference(self, point_cloud: np.ndarray) -> np.ndarray:
        """Run inference on a single point cloud. Input/output are numpy arrays.

        Args:
            point_cloud: (N, 7) float32 array
        Returns:
            labels: (N,) int array of class indices
        """
        self.eval()
        device = next(self.parameters()).device
        x = torch.from_numpy(point_cloud).unsqueeze(0).float().to(device)
        with torch.no_grad():
            logits = self.forward(x)  # (1, N, C)
            probs = F.softmax(logits, dim=-1)
        labels = probs[0].argmax(dim=-1).cpu().numpy()
        return labels

    def inference_with_probs(self, point_cloud: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Run inference returning both labels and probabilities.

        Returns:
            (labels (N,), probabilities (N, C))
        """
        self.eval()
        device = next(self.parameters()).device
        x = torch.from_numpy(point_cloud).unsqueeze(0).float().to(device)
        with torch.no_grad():
            logits = self.forward(x)
            probs = F.softmax(logits, dim=-1)
        probs_np = probs[0].cpu().numpy()
        labels = probs_np.argmax(axis=-1)
        return labels, probs_np

    def model_summary(self) -> dict:
        """Return model parameter count and architecture summary."""
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {
            "model_name": "MeshSegNet",
            "num_classes": self.num_classes,
            "total_parameters": total,
            "trainable_parameters": trainable,
            "input_shape": f"(B, {AI_POINT_CLOUD_SIZE}, 7)",
            "output_shape": f"(B, {AI_POINT_CLOUD_SIZE}, {self.num_classes})",
        }


class FocalLoss(nn.Module):
    """Focal Loss for handling class imbalance in tooth segmentation."""

    def __init__(self, gamma: float = 2.0, weight: torch.Tensor | None = None) -> None:
        super().__init__()
        self.gamma = gamma
        self.weight = weight

    def forward(self, inputs: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """Compute focal loss. inputs: (B*N, C), targets: (B*N,)."""
        ce_loss = F.cross_entropy(inputs, targets, weight=self.weight, reduction="none")
        pt = torch.exp(-ce_loss)
        focal_loss = ((1 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()
