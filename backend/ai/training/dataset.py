# dataset.py — PyTorch Dataset for dental mesh segmentation training.

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset

from ai.data.augmentor import augment_point_cloud
from ai.pipeline.preprocessor import process_mesh_with_instructions
from app.constants import AI_POINT_CLOUD_SIZE

logger = logging.getLogger(__name__)


class DentalMeshDataset(Dataset):
    """PyTorch Dataset for dental mesh segmentation.

    Each sample is a (point_cloud, labels) pair where:
    - point_cloud: (N, 7) tensor — XYZ + normals + curvature
    - labels: (N,) tensor — per-point class indices
    """

    def __init__(
        self,
        data_dir: str,
        n_points: int = AI_POINT_CLOUD_SIZE,
        augment: bool = False,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.n_points = n_points
        self.augment = augment
        self.samples = self._discover_samples()
        logger.info("Dataset: %d samples from %s", len(self.samples), data_dir)

    def _discover_samples(self) -> list[tuple[Path, Path]]:
        """Find mesh files with matching label files."""
        samples = []
        mesh_dir = self.data_dir / "meshes"
        label_dir = self.data_dir / "labels"
        if not mesh_dir.exists():
            logger.warning("No meshes directory found at %s", mesh_dir)
            return samples
        for mesh_path in sorted(mesh_dir.glob("*.stl")):
            label_path = label_dir / f"{mesh_path.stem}.npy"
            if label_path.exists():
                samples.append((mesh_path, label_path))
        return samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        mesh_path, label_path = self.samples[idx]
        # Preprocess mesh
        result = process_mesh_with_instructions(
            str(mesh_path), instructions={}, n_points=self.n_points,
        )
        point_cloud = result.point_cloud
        # Load labels
        raw_labels = np.load(str(label_path))
        # Subsample labels to match point count
        if len(raw_labels) >= self.n_points:
            indices = np.random.choice(len(raw_labels), self.n_points, replace=False)
            labels = raw_labels[indices]
        else:
            labels = np.zeros(self.n_points, dtype=np.int64)
            labels[:len(raw_labels)] = raw_labels

        if self.augment:
            point_cloud = augment_point_cloud(point_cloud)

        return (
            torch.from_numpy(point_cloud).float(),
            torch.from_numpy(labels).long(),
        )
