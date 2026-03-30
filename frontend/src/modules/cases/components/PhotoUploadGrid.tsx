// PhotoUploadGrid.tsx — Guided photo upload with silhouette placeholders.

import { useRef } from 'react';
import { Camera, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Photo slot definitions                                             */
/* ------------------------------------------------------------------ */

interface PhotoSlot {
  id: string;
  label: string;
  fileType: string;
  category: 'face' | 'intraoral' | 'xray';
  silhouette: string; // SVG path for the guide outline
}

const PHOTO_SLOTS: PhotoSlot[] = [
  // Face photos
  { id: 'front_face', label: 'Front Face', fileType: 'FRONT_FACE', category: 'face',
    silhouette: 'M50,15 C50,15 35,15 30,30 C25,45 25,55 30,65 C35,75 42,82 50,85 C58,82 65,75 70,65 C75,55 75,45 70,30 C65,15 50,15 50,15 Z' },
  { id: 'side_profile', label: 'Side Profile', fileType: 'SIDE_PROFILE', category: 'face',
    silhouette: 'M35,15 C35,15 30,15 28,25 C26,35 30,45 32,50 C34,55 30,60 30,65 C30,70 32,75 35,80 C38,85 45,87 50,85 C55,83 60,78 62,70 C64,62 60,55 58,50 C56,45 58,38 55,28 C52,18 45,15 35,15 Z' },
  { id: 'smile', label: 'Smile', fileType: 'SMILE_PHOTO', category: 'face',
    silhouette: 'M25,40 C25,40 30,30 50,30 C70,30 75,40 75,40 C75,40 75,55 70,60 C65,65 55,68 50,68 C45,68 35,65 30,60 C25,55 25,40 25,40 Z' },
  // Intraoral photos
  { id: 'upper_occlusal', label: 'Upper Occlusal', fileType: 'UPPER_OCCLUSAL_PHOTO', category: 'intraoral',
    silhouette: 'M30,75 C30,75 25,60 25,45 C25,30 35,20 50,18 C65,20 75,30 75,45 C75,60 70,75 70,75 C70,75 60,78 50,78 C40,78 30,75 30,75 Z' },
  { id: 'lower_occlusal', label: 'Lower Occlusal', fileType: 'LOWER_OCCLUSAL_PHOTO', category: 'intraoral',
    silhouette: 'M30,25 C30,25 25,40 25,55 C25,70 35,80 50,82 C65,80 75,70 75,55 C75,40 70,25 70,25 C70,25 60,22 50,22 C40,22 30,25 30,25 Z' },
  { id: 'front_intraoral', label: 'Front Intraoral', fileType: 'FRONT_INTRAORAL', category: 'intraoral',
    silhouette: 'M25,30 L75,30 L75,70 L25,70 Z M35,45 L65,45 M35,55 L65,55' },
  { id: 'left_buccal', label: 'Left Buccal', fileType: 'LEFT_BUCCAL', category: 'intraoral',
    silhouette: 'M20,35 L80,35 L80,65 L20,65 Z M30,48 L70,48 M30,52 L70,52' },
  { id: 'right_buccal', label: 'Right Buccal', fileType: 'RIGHT_BUCCAL', category: 'intraoral',
    silhouette: 'M20,35 L80,35 L80,65 L20,65 Z M30,48 L70,48 M30,52 L70,52' },
  // X-rays
  { id: 'lateral_ceph', label: 'Lateral Ceph', fileType: 'LATERAL_CEPH', category: 'xray',
    silhouette: 'M30,15 C30,15 25,20 25,40 C25,60 30,75 40,80 C50,85 60,80 65,70 C70,60 70,45 65,30 C60,15 45,12 30,15 Z' },
  { id: 'panoramic', label: 'Panoramic X-Ray', fileType: 'PANORAMIC_XRAY', category: 'xray',
    silhouette: 'M15,40 C15,40 20,25 35,20 C50,15 65,20 80,25 C85,30 85,50 80,60 C75,70 60,75 50,75 C40,75 25,70 20,60 C15,50 15,40 15,40 Z' },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface PhotoUploadGridProps {
  photos: Record<string, File | null>;
  onPhotoChange: (slotId: string, fileType: string, file: File | null) => void;
}

export function PhotoUploadGrid({ photos, onPhotoChange }: PhotoUploadGridProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = (slot: PhotoSlot, file: File | null) => {
    onPhotoChange(slot.id, slot.fileType, file);
  };

  const categories = [
    { key: 'face', label: 'Patient Photos', desc: 'Front face, side profile, and smile' },
    { key: 'intraoral', label: 'Intraoral Photos', desc: 'Occlusal views and buccal views' },
    { key: 'xray', label: 'X-Rays', desc: 'Lateral cephalogram and panoramic' },
  ] as const;

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const slots = PHOTO_SLOTS.filter((s) => s.category === cat.key);
        return (
          <div key={cat.key} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4">
              <h3 className="text-sm font-bold text-dark-text">{cat.label}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{cat.desc}</p>
            </div>
            <div className="p-5">
              <div className={cn(
                'grid gap-4',
                cat.key === 'face' ? 'grid-cols-3' :
                cat.key === 'intraoral' ? 'grid-cols-3 sm:grid-cols-5' :
                'grid-cols-2',
              )}>
                {slots.map((slot) => {
                  const file = photos[slot.id];
                  const preview = file ? URL.createObjectURL(file) : null;

                  return (
                    <div key={slot.id} className="relative group">
                      <input
                        ref={(el) => { fileInputRefs.current[slot.id] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          handleFileSelect(slot, f);
                        }}
                      />

                      {preview ? (
                        /* Image preview */
                        <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-electric/30 bg-slate-50">
                          <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                          <button
                            onClick={() => handleFileSelect(slot, null)}
                            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        /* Empty slot with silhouette */
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          className="w-full aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 hover:border-electric/40 hover:bg-blue-50/30 transition-all duration-200 group/slot"
                        >
                          <svg viewBox="0 0 100 100" className="w-12 h-12 text-slate-300 group-hover/slot:text-electric/40 transition-colors">
                            <path d={slot.silhouette} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3,2" />
                          </svg>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 group-hover/slot:text-electric/60">
                            <Camera className="h-3 w-3" />
                            <span>Upload</span>
                          </div>
                        </button>
                      )}

                      <p className="mt-1.5 text-center text-[10px] font-medium text-slate-500">{slot.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
