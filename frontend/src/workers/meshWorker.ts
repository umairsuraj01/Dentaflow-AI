// meshWorker.ts — Offloads mesh processing from UI thread.

interface MeshWorkerMessage {
  type: 'parse-stl';
  id: string;
  buffer: ArrayBuffer;
}

interface MeshWorkerResult {
  type: 'stl-parsed';
  id: string;
  positions: Float32Array;
  normals: Float32Array;
  vertexCount: number;
}

self.onmessage = (e: MessageEvent<MeshWorkerMessage>) => {
  const { type, id, buffer } = e.data;

  if (type === 'parse-stl') {
    const result = parseSTLBinary(buffer);
    self.postMessage(
      { type: 'stl-parsed', id, ...result } as MeshWorkerResult,
      [result.positions.buffer, result.normals.buffer] as any,
    );
  }
};

function parseSTLBinary(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);

  let offset = 84;
  for (let i = 0; i < triangleCount; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    for (let v = 0; v < 3; v++) {
      const base = i * 9 + v * 3;
      positions[base] = view.getFloat32(offset, true);
      positions[base + 1] = view.getFloat32(offset + 4, true);
      positions[base + 2] = view.getFloat32(offset + 8, true);
      normals[base] = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
      offset += 12;
    }
    offset += 2; // attribute byte count
  }

  return { positions, normals, vertexCount: triangleCount * 3 };
}
