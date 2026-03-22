// ExportPanel.tsx — Phase 10 print export: validation, support estimation, batch download.

import { useState } from 'react';
import { Loader2, Printer, Download, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { analysisService } from '../services/analysis.service';
import type { PrintValidation, SupportEstimate } from '../types/analysis.types';

interface Props {
  filePath: string;
  jaw?: string;
}

export function ExportPanel({ filePath, jaw: _jaw }: Props) {
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<PrintValidation | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [supports, setSupports] = useState<SupportEstimate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    setError(null);
    try {
      const result = await analysisService.validateForPrinting(filePath);
      setValidation(result);
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleEstimateSupports = async () => {
    setIsEstimating(true);
    setError(null);
    try {
      const result = await analysisService.estimateSupports(filePath);
      setSupports(result);
    } catch (err: any) {
      setError(err.message || 'Support estimation failed');
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {/* ── Print Validation ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Printer className="h-4 w-4" />
            Print Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-gray-500">
            Check mesh quality for 3D printing: watertight, manifold, wall thickness.
          </p>

          <Button
            size="sm"
            className="w-full"
            onClick={handleValidate}
            disabled={isValidating}
          >
            {isValidating ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Validating...</>
            ) : (
              <><Printer className="mr-1 h-3.5 w-3.5" />Validate for Print</>
            )}
          </Button>

          {validation && (
            <div className="space-y-2">
              {/* Pass/Fail banner */}
              <div
                className={cn(
                  'rounded-lg px-3 py-2 flex items-center gap-2',
                  validation.is_printable
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700',
                )}
              >
                {validation.is_printable ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span className="text-xs font-semibold">
                  {validation.is_printable ? 'Ready to Print' : 'Not Printable'}
                </span>
              </div>

              {/* Checks grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <span className="text-gray-500">Watertight:</span>
                <span className={cn('font-medium', validation.is_watertight ? 'text-green-600' : 'text-red-600')}>
                  {validation.is_watertight ? 'Yes' : 'No'}
                </span>
                <span className="text-gray-500">Manifold:</span>
                <span className={cn('font-medium', validation.is_manifold ? 'text-green-600' : 'text-red-600')}>
                  {validation.is_manifold ? 'Yes' : 'No'}
                </span>
                <span className="text-gray-500">Min wall:</span>
                <span className="font-medium text-gray-700">
                  {validation.min_wall_thickness_mm.toFixed(2)}mm
                </span>
                <span className="text-gray-500">Volume:</span>
                <span className="font-medium text-gray-700">
                  {validation.volume_mm3.toFixed(1)}mm³
                </span>
                <span className="text-gray-500">Surface:</span>
                <span className="font-medium text-gray-700">
                  {validation.surface_area_mm2.toFixed(1)}mm²
                </span>
                <span className="text-gray-500">Faces:</span>
                <span className="font-medium text-gray-700">
                  {validation.face_count.toLocaleString()}
                </span>
                <span className="text-gray-500">Vertices:</span>
                <span className="font-medium text-gray-700">
                  {validation.vertex_count.toLocaleString()}
                </span>
                <span className="text-gray-500">Bounding box:</span>
                <span className="font-medium text-gray-700">
                  {validation.bounding_box_mm.map((v) => v.toFixed(1)).join(' × ')}
                </span>
              </div>

              {/* Issues */}
              {validation.issues.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-[10px] font-semibold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Issues ({validation.issues.length})
                  </h4>
                  <ul className="space-y-0.5">
                    {validation.issues.map((issue, i) => (
                      <li key={i} className="text-[10px] text-red-600 pl-3">
                        • {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Support Estimation ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Support Estimation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[11px] text-gray-500">
            Estimate support material requirements and recommended print orientation.
          </p>

          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleEstimateSupports}
            disabled={isEstimating}
          >
            {isEstimating ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Estimating...</>
            ) : (
              'Estimate Supports'
            )}
          </Button>

          {supports && (
            <div className="rounded-lg bg-blue-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-blue-700">Support Analysis</p>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-blue-600">
                <span>Support volume:</span>
                <span className="font-medium">{supports.support_volume_mm3.toFixed(1)}mm³</span>
                <span>Overhang area:</span>
                <span className="font-medium">{supports.overhang_area_mm2.toFixed(1)}mm²</span>
                <span>Overhang faces:</span>
                <span className="font-medium">{supports.overhang_face_count.toLocaleString()}</span>
                <span>Support %:</span>
                <span className="font-medium">{supports.support_percentage.toFixed(1)}%</span>
                <span>Orientation:</span>
                <span className="font-medium capitalize">
                  {supports.recommended_orientation.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Export Actions ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-[11px] text-gray-500">
            Download meshes for 3D printing or further processing.
          </p>
          <div className="grid grid-cols-3 gap-1">
            {['STL', 'OBJ', 'PLY'].map((fmt) => (
              <button
                key={fmt}
                className="rounded-md border border-gray-200 py-2 text-[10px] font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {fmt}
              </button>
            ))}
          </div>
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
            Batch export will package all stage meshes into a ZIP archive.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
