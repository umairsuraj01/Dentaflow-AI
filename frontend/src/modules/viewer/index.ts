// modules/viewer/index.ts — Public API of the 3D viewer module.

export { DentalViewer3D } from './components/DentalViewer3D';
export { SegmentationOverlay } from './components/SegmentationOverlay';
export { SegmentationStats } from './components/SegmentationStats';
export { ToothCorrection } from './components/ToothCorrection';
export { useSegmentation, useAIStats } from './hooks/useSegmentation';
export { segmentationService } from './services/segmentation.service';
export type * from './types/segmentation.types';
