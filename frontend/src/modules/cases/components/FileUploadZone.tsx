// FileUploadZone.tsx — Drag-drop file upload with progress bars.

import { useCallback, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { UploadingFile } from '../hooks/useFileUpload';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[], fileType: string) => void;
  uploads: UploadingFile[];
  onRemove: (index: number) => void;
  accept?: string;
  fileType?: string;
  label?: string;
}

export function FileUploadZone({
  onFilesSelected, uploads, onRemove,
  accept = '.stl,.obj,.ply,.jpg,.jpeg,.png,.pdf',
  fileType = 'OTHER',
  label = 'Drop files here or click to upload',
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFilesSelected(files, fileType);
  }, [onFilesSelected, fileType]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected(files, fileType);
    e.target.value = '';
  }, [onFilesSelected, fileType]);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-soft-gray/50 p-8 transition-colors hover:border-electric hover:bg-blue-50/50"
      >
        <Upload className="h-8 w-8 text-gray-400" />
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xs text-gray-400">STL, OBJ, PLY, JPG, PNG, PDF</p>
        <input ref={inputRef} type="file" multiple accept={accept} onChange={handleChange} className="hidden" />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
              <FileText className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-dark-text">{upload.file.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        upload.status === 'error' ? 'bg-red-500' : 'bg-electric',
                      )}
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{upload.progress}%</span>
                </div>
              </div>
              {upload.status === 'done' && <CheckCircle className="h-5 w-5 shrink-0 text-mint" />}
              {upload.status === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />}
              <button onClick={() => onRemove(i)} className="text-gray-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
