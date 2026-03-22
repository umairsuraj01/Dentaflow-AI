// useMeshWorker.ts — Hook that manages a Web Worker for off-thread mesh processing.

import { useRef, useCallback, useEffect } from 'react';

interface ParseResult {
  positions: Float32Array;
  normals: Float32Array;
  vertexCount: number;
}

export function useMeshWorker() {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef<Map<string, (result: any) => void>>(new Map());

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../workers/meshWorker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current.onmessage = (e) => {
      const { id } = e.data;
      const cb = callbacksRef.current.get(id);
      if (cb) {
        cb(e.data);
        callbacksRef.current.delete(id);
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const parseSTL = useCallback(
    (buffer: ArrayBuffer): Promise<ParseResult> => {
      return new Promise((resolve) => {
        const id = crypto.randomUUID();
        callbacksRef.current.set(id, (result) => {
          resolve({
            positions: result.positions,
            normals: result.normals,
            vertexCount: result.vertexCount,
          });
        });
        workerRef.current?.postMessage(
          { type: 'parse-stl', id, buffer },
          [buffer],
        );
      });
    },
    [],
  );

  return { parseSTL };
}
