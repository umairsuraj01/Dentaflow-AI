import { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface MobileUploadSheetProps {
  open: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export function MobileUploadSheet({ open, onClose, onFileSelected }: MobileUploadSheetProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Upload Scan">
      <div className="flex flex-col gap-3">
        {/* Camera option */}
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex min-h-[3.5rem] w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left active:bg-gray-100 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Take Photo</p>
            <p className="text-xs text-gray-500">Use camera to capture scan</p>
          </div>
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        {/* File option */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex min-h-[3.5rem] w-full items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left active:bg-gray-100 transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Choose File</p>
            <p className="text-xs text-gray-500">STL, PLY, OBJ, or ZIP</p>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl,.ply,.obj,.zip"
          onChange={handleFile}
          className="hidden"
        />

        {/* Upload progress bar (UI placeholder) */}
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-0 rounded-full bg-blue-500 transition-all duration-300" />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
