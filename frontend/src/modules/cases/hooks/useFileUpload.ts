// useFileUpload.ts — Hook for S3 presigned URL upload flow with progress.
// REACT NATIVE READY: no DOM dependencies.

import { useState, useCallback } from 'react';
import { caseService } from '../services/case.service';
import type { CaseFile } from '../types/case.types';

export interface UploadingFile {
  file: File;
  fileType: string;
  progress: number;
  status: 'pending' | 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
  result?: CaseFile;
}

export function useFileUpload(caseId: string | undefined) {
  const [uploads, setUploads] = useState<UploadingFile[]>([]);

  const updateUpload = useCallback((index: number, patch: Partial<UploadingFile>) => {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }, []);

  const uploadFile = useCallback(async (file: File, fileType: string) => {
    if (!caseId) return;
    const index = uploads.length;
    const entry: UploadingFile = { file, fileType, progress: 0, status: 'pending' };
    setUploads((prev) => [...prev, entry]);

    try {
      updateUpload(index, { status: 'uploading', progress: 10 });
      const { upload_url, file_id } = await caseService.getUploadUrl(caseId, {
        file_type: fileType,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || undefined,
      });
      updateUpload(index, { progress: 30 });

      await fetch(upload_url, { method: 'PUT', body: file });
      updateUpload(index, { progress: 80, status: 'confirming' });

      const result = await caseService.confirmUpload(caseId, file_id);
      updateUpload(index, { progress: 100, status: 'done', result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      updateUpload(index, { status: 'error', error: message });
    }
  }, [caseId, uploads.length, updateUpload]);

  const removeUpload = useCallback((index: number) => {
    setUploads((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return { uploads, uploadFile, removeUpload };
}
