// REACT NATIVE: Has DOM dependencies (Three.js, STLLoader, BufferGeometry). Needs RN adapter.
// useToothMeshes.ts — Fetches extracted tooth meshes and loads them as Three.js geometries.

import { useState } from 'react';
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

import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const stlParser = new STLLoader();

/** Parse an ArrayBuffer as STL geometry. If mergeVerts is true, merge
 *  coincident vertices so computeVertexNormals produces smooth shading. */
function parseSTL(buffer: ArrayBuffer, mergeVerts = false): THREE.BufferGeometry {
  let geo = stlParser.parse(buffer);
  if (mergeVerts) {
    try {
      geo = mergeVertices(geo, 0.0001);
    } catch {
      // fallback: use raw geometry
    }
  }
  return geo;
}

export function useToothMeshes(): UseToothMeshesResult {
  const [teeth, setTeeth] = useState<LoadedTooth[]>([]);
  const [gumGeometry, setGumGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractionId, setExtractionId] = useState<string | null>(null);

  const extract = async (filePath: string) => {
    setIsExtracting(true);
    setError(null);
    setTeeth([]);
    setGumGeometry(null);

    try {
      // Step 1: Call extract-teeth endpoint
      console.log('[useToothMeshes] Extracting teeth from:', filePath);
      const data: TeethExtraction = await treatmentService.extractTeeth(filePath);
      console.log('[useToothMeshes] Extraction done:', data.extraction_id, Object.keys(data.teeth).length, 'teeth');
      setExtractionId(data.extraction_id);
      setIsExtracting(false);
      setIsLoading(true);

      // Step 2: Fetch each tooth mesh as ArrayBuffer and parse
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
            const buffer = await treatmentService.fetchToothMeshBuffer(entry.mesh_url);
            const geometry = parseSTL(buffer, true); // merge vertices for smooth tooth normals
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

      console.log('[useToothMeshes] Loaded', loaded.length, 'tooth meshes');
      setTeeth(loaded);

      // Step 3: Load gum mesh
      if (data.gum_mesh_url) {
        try {
          const gumBuffer = await treatmentService.fetchToothMeshBuffer(data.gum_mesh_url);
          // Merge vertices with larger tolerance for smoother gum normals
          const gumGeo = parseSTL(gumBuffer, true);
          gumGeo.computeVertexNormals();
          setGumGeometry(gumGeo);
        } catch (gumErr) {
          console.warn('[useToothMeshes] Gum mesh failed, trying without merge:', gumErr);
          try {
            const gumBuffer = await treatmentService.fetchToothMeshBuffer(data.gum_mesh_url);
            const gumGeo = parseSTL(gumBuffer, false);
            gumGeo.computeVertexNormals();
            setGumGeometry(gumGeo);
          } catch {
            // Gum mesh is optional
          }
        }
      }
    } catch (err: any) {
      console.error('[useToothMeshes] Error:', err);
      setError(err.response?.data?.message || err.message || 'Unknown error during extraction');
    } finally {
      setIsExtracting(false);
      setIsLoading(false);
    }
  };

  return { teeth, gumGeometry, isExtracting, isLoading, error, extractionId, extract };
}
