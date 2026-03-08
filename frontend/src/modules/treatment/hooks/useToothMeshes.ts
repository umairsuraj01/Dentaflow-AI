// useToothMeshes.ts — Fetches extracted tooth meshes and loads them as Three.js geometries.

import { useState, useEffect, useRef } from 'react';
import { STLLoader } from 'three-stdlib';
import * as THREE from 'three';
import { treatmentService } from '../services/treatment.service';
import type { TeethExtraction } from '../types/treatment.types';

export interface LoadedTooth {
  fdi: number;
  geometry: THREE.BufferGeometry;
  centroid: [number, number, number];
  bbox_min: [number, number, number];
  bbox_max: [number, number, number];
}

interface UseToothMeshesResult {
  teeth: LoadedTooth[];
  gumGeometry: THREE.BufferGeometry | null;
  isExtracting: boolean;
  isLoading: boolean;
  error: string | null;
  extractionId: string | null;
  extract: (filePath: string) => Promise<void>;
}

const stlLoader = new STLLoader();

function loadSTLFromBlob(blobUrl: string): Promise<THREE.BufferGeometry> {
  return new Promise((resolve, reject) => {
    stlLoader.load(blobUrl, resolve, undefined, reject);
  });
}

export function useToothMeshes(): UseToothMeshesResult {
  const [teeth, setTeeth] = useState<LoadedTooth[]>([]);
  const [gumGeometry, setGumGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const extract = async (filePath: string) => {
    setIsExtracting(true);
    setError(null);
    setTeeth([]);
    setGumGeometry(null);

    // Revoke old blob URLs
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrlsRef.current = [];

    try {
      // Step 1: Call extract-teeth endpoint
      const data: TeethExtraction = await treatmentService.extractTeeth(filePath);
      setExtractionId(data.extraction_id);
      setIsExtracting(false);
      setIsLoading(true);

      // Step 2: Fetch each tooth mesh with auth and load as geometry
      const toothEntries = Object.entries(data.teeth)
        .filter(([key]) => Number(key) !== 0)
        .map(([key, tooth]) => ({ ...tooth, fdi: Number(key) }));

      const loaded: LoadedTooth[] = [];

      // Load teeth in parallel (batched to avoid overwhelming the browser)
      const batchSize = 8;
      for (let i = 0; i < toothEntries.length; i += batchSize) {
        const batch = toothEntries.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (entry) => {
            const blobUrl = await treatmentService.fetchToothMesh(entry.mesh_url);
            blobUrlsRef.current.push(blobUrl);
            const geometry = await loadSTLFromBlob(blobUrl);
            geometry.computeVertexNormals();
            return {
              fdi: entry.fdi,
              geometry,
              centroid: entry.centroid,
              bbox_min: entry.bbox_min,
              bbox_max: entry.bbox_max,
            };
          }),
        );
        loaded.push(...results);
      }

      setTeeth(loaded);

      // Step 3: Load gum mesh
      if (data.gum_mesh_url) {
        try {
          const gumBlobUrl = await treatmentService.fetchToothMesh(data.gum_mesh_url);
          blobUrlsRef.current.push(gumBlobUrl);
          const gumGeo = await loadSTLFromBlob(gumBlobUrl);
          gumGeo.computeVertexNormals();
          setGumGeometry(gumGeo);
        } catch {
          // Gum mesh is optional, don't fail
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsExtracting(false);
      setIsLoading(false);
    }
  };

  return { teeth, gumGeometry, isExtracting, isLoading, error, extractionId, extract };
}
