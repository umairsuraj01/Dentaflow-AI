# pipeline_manager.py — Orchestrates the full AI segmentation pipeline.

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

import numpy as np

from ai.pipeline.preprocessor import process_mesh_with_instructions
from ai.pipeline.segmentation_runner import run_inference
from ai.pipeline.postprocessor import (
    smooth_labels,
    remove_floating_segments,
    enforce_restrictions,
    generate_per_tooth_confidence,
)
from ai.utils.fdi_numbering import class_to_fdi
from ai.utils.visualization import (
    map_labels_to_faces,
    generate_colored_mesh,
    export_colored_mesh,
    get_fdi_color_map,
)
from app.constants import AI_POINT_CLOUD_SIZE

logger = logging.getLogger(__name__)


@dataclass
class SegmentationOutput:
    """Complete output of the AI segmentation pipeline."""

    labels: np.ndarray                        # (N,) per-point class indices
    probabilities: np.ndarray                 # (N, C) per-point probabilities
    confidence_scores: dict[int, float]       # {fdi: score}
    teeth_found: list[int]                    # FDI numbers detected
    restricted_fdi: list[int]                 # restricted teeth from instructions
    overridden_points_count: int              # points adjusted by restriction
    processing_time_seconds: float
    total_points: int
    model_version: str = "mock_v1"
    face_labels: np.ndarray | None = None     # (F,) per-face class indices
    sampled_points: np.ndarray | None = None  # (N, 3) sampled point positions
    metadata: dict = field(default_factory=dict)


def run_full_pipeline(
    file_path: str,
    instructions: dict[int, list[dict]] | None = None,
    n_points: int = AI_POINT_CLOUD_SIZE,
    checkpoint_path: str | None = None,
    output_mesh_path: str | None = None,
    generate_face_data: bool = True,
) -> SegmentationOutput:
    """Run the complete segmentation pipeline end to end.

    1. Preprocess mesh + attach instruction metadata
    2. Run AI inference (or mock)
    3. Post-process: smooth, clean, enforce restrictions
    4. Generate confidence scores
    5. Map labels to mesh faces + optionally export colored mesh
    """
    start = time.time()
    instructions = instructions or {}

    # Step 1: Preprocess
    logger.info("Step 1/5: Preprocessing mesh...")
    processed = process_mesh_with_instructions(
        file_path, instructions, n_points,
    )

    # Step 2: Inference
    logger.info("Step 2/5: Running AI inference...")
    raw_labels, probs = run_inference(
        processed.point_cloud, checkpoint_path,
    )

    # Step 3: Post-process
    logger.info("Step 3/5: Post-processing labels...")
    smoothed = smooth_labels(raw_labels, processed.point_cloud)
    cleaned = remove_floating_segments(smoothed, processed.point_cloud)
    final_labels, overridden = enforce_restrictions(
        cleaned, processed.restricted_fdi, raw_labels,
    )

    # Step 4: Confidence scores
    logger.info("Step 4/5: Computing confidence scores...")
    confidence = generate_per_tooth_confidence(probs, final_labels)
    teeth_found = sorted([
        class_to_fdi(int(c)) for c in np.unique(final_labels) if c != 0
    ])

    # Step 5: Map labels to mesh faces
    face_labels_arr = None
    sampled_pts = processed.point_cloud[:, :3]

    if generate_face_data:
        logger.info("Step 5/5: Mapping labels to mesh faces...")
        try:
            from ai.data.mesh_loader import load_mesh
            mesh = load_mesh(file_path)
            face_labels_arr = map_labels_to_faces(
                mesh, sampled_pts, final_labels, k=3,
            )

            # Optionally export colored mesh
            if output_mesh_path:
                colored = generate_colored_mesh(
                    mesh, face_labels_arr, processed.restricted_fdi,
                )
                export_colored_mesh(colored, output_mesh_path, file_type="ply")
        except Exception as exc:
            logger.error("Failed to generate face data: %s", exc)

    elapsed = time.time() - start
    logger.info(
        "Pipeline complete: %d teeth found in %.2fs",
        len(teeth_found), elapsed,
    )

    return SegmentationOutput(
        labels=final_labels,
        probabilities=probs,
        confidence_scores=confidence,
        teeth_found=teeth_found,
        restricted_fdi=processed.restricted_fdi,
        overridden_points_count=overridden,
        processing_time_seconds=round(elapsed, 2),
        total_points=n_points,
        face_labels=face_labels_arr,
        sampled_points=sampled_pts,
        metadata=processed.metadata,
    )
