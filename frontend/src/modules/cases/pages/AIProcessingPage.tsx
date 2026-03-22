// AIProcessingPage.tsx — Integrated AI segmentation view: 3D viewer with colored teeth + side panel.

import { useState, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Brain, BarChart3, Wrench, Loader2, Play, RefreshCw, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/modules/auth';
import { useCaseDetail } from '../hooks/useCaseDetail';
import { DentalViewer3D, type SegmentationData } from '@/modules/viewer/components/DentalViewer3D';
import { MeshQualityCard } from '../components/MeshQualityCard';
import { segmentationService, type MeshRepairResponse } from '@/modules/viewer/services/segmentation.service';
import api from '@/lib/api';
import { FDI_UPPER, FDI_LOWER, AI_CONFIDENCE } from '@/constants/app';
import { getFdiColorHex, getToothName } from '@/modules/viewer/utils/fdi';

// Local STL files for dev testing
const DEV_FILES = [
  { label: 'Maxillary (upper)', path: '/Users/umairsuraj/Downloads/maxillary_export.stl' },
  { label: 'Mandibular (lower)', path: '/Users/umairsuraj/Downloads/mandibulary_export.stl' },
  { label: 'Dr Hamid Upper', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-upperjaw.stl" },
  { label: 'Dr Hamid Lower', path: "/Users/umairsuraj/Downloads/02022026-dr hamid's Case-lowerjaw.stl" },
];

type SideTab = 'quality' | 'results' | 'corrections';
const ALL_SIDE_TABS: { id: SideTab; label: string; icon: typeof BarChart3; techOnly?: boolean }[] = [
  { id: 'quality', label: 'Quality', icon: Shield },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'corrections', label: 'Corrections', icon: Wrench, techOnly: true },
];

interface AIResult {
  teeth_found: number[];
  total_points: number;
  processing_time: number;
  model_version: string;
  confidence_scores: Record<string, number>;
  restricted_fdi: number[];
  overridden_count: number;
  face_labels: number[];
  fdi_color_map: Record<number, number[]>;
  fdi_name_map: Record<number, string>;
  total_faces: number;
}

export function AIProcessingPage() {
  const { id: caseId } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { caseData, isLoading } = useCaseDetail(caseId);

  const [sideTab, setSideTab] = useState<SideTab>('quality');
  const [selectedFile, setSelectedFile] = useState(DEV_FILES[0].path);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<MeshRepairResponse | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [segData, setSegData] = useState<SegmentationData | undefined>();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [repairedFilePath, setRepairedFilePath] = useState<string | null>(null);

  const isTechnician = user?.role === 'TECHNICIAN' || user?.role === 'SUPER_ADMIN';

  // Fetch STL file with auth headers and create a blob URL for the 3D viewer
  useEffect(() => {
    let cancelled = false;
    const fetchFile = async () => {
      // Revoke old blob URL
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
      setFileLoading(true);
      try {
        const res = await api.get(`/ai/serve-file?path=${encodeURIComponent(selectedFile)}`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        const url = URL.createObjectURL(res.data);
        setBlobUrl(url);
      } catch (err: any) {
        if (!cancelled) setError(`Failed to load file: ${err.message}`);
      } finally {
        if (!cancelled) setFileLoading(false);
      }
    };
    fetchFile();
    return () => { cancelled = true; };
  }, [selectedFile]);

  // Reset repair state when file changes
  useEffect(() => {
    setRepairResult(null);
    setRepairedFilePath(null);
  }, [selectedFile]);

  const handleRepairMesh = useCallback(async () => {
    setIsRepairing(true);
    setError(null);
    try {
      const result = await segmentationService.repairMesh({
        file_path: selectedFile,
      });
      setRepairResult(result);
      setRepairedFilePath(result.repaired_file_path);

      // Reload the 3D viewer with the repaired mesh
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      const res = await api.get(`/ai/serve-file?path=${encodeURIComponent(result.repaired_file_path)}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      setBlobUrl(url);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Mesh repair failed');
    } finally {
      setIsRepairing(false);
    }
  }, [selectedFile, blobUrl]);

  const handleRunAI = useCallback(async () => {
    setIsProcessing(true);
    setError(null);
    setAiResult(null);
    setSegData(undefined);
    setSelectedTooth(null);
    try {
      const filePath = repairedFilePath || selectedFile;
      const res = await api.post('/ai/segment', { file_path: filePath });
      if (res.data.success) {
        const data = res.data.data as AIResult;
        setAiResult(data);
        setSegData({
          faceLabels: data.face_labels,
          teethFound: data.teeth_found,
          confidenceScores: data.confidence_scores,
          restrictedFdi: data.restricted_fdi,
          fdiColorMap: data.fdi_color_map,
          fdiNameMap: data.fdi_name_map,
        });
      } else {
        setError(res.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile]);

  const handleToothSelect = useCallback((fdi: number | null) => {
    setSelectedTooth(fdi);
  }, []);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={caseId ? `/cases/${caseId}` : '/cases'} className="text-gray-400 hover:text-dark-text">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Brain className="h-5 w-5 text-blue-500" />
          <h1 className="text-lg font-bold text-dark-text">
            AI Tooth Segmentation{caseData ? ` — ${caseData.case_number}` : ''}
          </h1>
        </div>

        {/* File selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
          >
            {DEV_FILES.map((f) => (
              <option key={f.path} value={f.path}>{f.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleRunAI}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Processing...</>
            ) : aiResult ? (
              <><RefreshCw className="mr-1 h-3.5 w-3.5" />Re-run AI</>
            ) : (
              <><Play className="mr-1 h-3.5 w-3.5" />Run AI Segmentation</>
            )}
          </Button>
          {aiResult && caseId && (
            <Link
              to={`/cases/${caseId}/treatment`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Proceed to Treatment Planning →
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      {/* Main layout: viewer + side panel */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 3D Viewer */}
        <div className="flex-1 overflow-hidden">
          {fileLoading ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-gradient-to-b from-[#0F172A] to-[#1e293b]">
              <div className="text-center">
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-white/40" />
                <p className="text-sm text-white/50">Loading 3D scan...</p>
              </div>
            </div>
          ) : (
            <DentalViewer3D
              fileUrl={blobUrl ?? undefined}
              segmentation={segData}
              selectedTooth={selectedTooth}
              onToothSelect={(fdi) => handleToothSelect(fdi)}
              correctionMode={sideTab === 'corrections' && isTechnician}
              className="h-full"
            />
          )}
        </div>

        {/* Side panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          {/* Tab switcher */}
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
            {ALL_SIDE_TABS.filter(tab => !tab.techOnly || isTechnician).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSideTab(tab.id)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors',
                  sideTab === tab.id
                    ? 'bg-white text-dark-text shadow-sm'
                    : 'text-gray-500 hover:text-dark-text',
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quality tab */}
          {sideTab === 'quality' && (
            <MeshQualityCard
              repairResult={repairResult}
              isRepairing={isRepairing}
              onRepair={handleRepairMesh}
            />
          )}

          {/* Results tab */}
          {sideTab === 'results' && aiResult && (
            <div className="space-y-4">
              {/* Summary stats */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Stat label="Teeth Found" value={aiResult.teeth_found.length} />
                    <Stat label="Total Points" value={aiResult.total_points.toLocaleString()} />
                    <Stat label="Time" value={`${aiResult.processing_time.toFixed(1)}s`} />
                    <Stat label="Model" value={aiResult.model_version} />
                    <Stat label="Faces Colored" value={aiResult.total_faces.toLocaleString()} />
                    <Stat label="Overridden" value={aiResult.overridden_count} />
                  </div>
                </CardContent>
              </Card>

              {/* Per-tooth confidence grid */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Per-Tooth Confidence</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <ToothGrid
                    label="Upper Arch"
                    teeth={FDI_UPPER as unknown as number[]}
                    result={aiResult}
                    selectedTooth={selectedTooth}
                    onSelect={setSelectedTooth}
                  />
                  <ToothGrid
                    label="Lower Arch"
                    teeth={FDI_LOWER as unknown as number[]}
                    result={aiResult}
                    selectedTooth={selectedTooth}
                    onSelect={setSelectedTooth}
                  />
                  <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 pt-2 border-t">
                    <Legend color="bg-emerald-500" label="High (>90%)" />
                    <Legend color="bg-amber-500" label="Medium (70-90%)" />
                    <Legend color="bg-red-500" label="Low (<70%)" />
                  </div>
                </CardContent>
              </Card>

              {/* Selected tooth detail */}
              {selectedTooth && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: getFdiColorHex(selectedTooth) }}
                      />
                      {getToothName(selectedTooth)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Confidence</span>
                        <span className="font-medium">
                          {aiResult.confidence_scores[String(selectedTooth)]
                            ? `${(aiResult.confidence_scores[String(selectedTooth)] * 100).toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Restricted</span>
                        <span className="font-medium">
                          {aiResult.restricted_fdi.includes(selectedTooth) ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {sideTab === 'results' && !aiResult && (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <Brain className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-400">
                  Select a scan file and click <strong>Run AI Segmentation</strong> to see teeth colored on the 3D model.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Corrections tab (only visible to technicians) */}
          {sideTab === 'corrections' && !aiResult && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-gray-400">
                Run AI segmentation first to enable corrections.
              </CardContent>
            </Card>
          )}

          {sideTab === 'corrections' && aiResult && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Correction Mode</CardTitle></CardHeader>
                <CardContent className="text-xs text-gray-500">
                  <p>Click on any tooth in the 3D viewer to select it. Then use the reassign panel to change its label.</p>
                  <p className="mt-2">Click on background to deselect.</p>
                </CardContent>
              </Card>
              {selectedTooth && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Selected: {getToothName(selectedTooth)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-500 mb-2">Reassign this tooth to:</p>
                    <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                      {aiResult.teeth_found.filter(t => t !== selectedTooth).map(t => (
                        <button
                          key={t}
                          className="rounded px-1 py-1.5 text-[10px] font-bold text-white hover:opacity-80"
                          style={{ backgroundColor: getFdiColorHex(t) }}
                          title={getToothName(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Helper components ─────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-dark-text">{value}</p>
    </div>
  );
}

function ToothGrid({
  label, teeth, result, selectedTooth, onSelect,
}: {
  label: string;
  teeth: number[];
  result: AIResult;
  selectedTooth: number | null;
  onSelect: (fdi: number | null) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-500">{label}</p>
      <div className="grid grid-cols-8 gap-1">
        {teeth.map((fdi) => {
          const score = result.confidence_scores[String(fdi)];
          const found = result.teeth_found.includes(fdi);
          const isSelected = selectedTooth === fdi;
          if (!found) {
            return (
              <div key={fdi} className="flex h-10 flex-col items-center justify-center rounded bg-gray-100 text-[9px] text-gray-300">
                <span>{fdi}</span>
                <span>—</span>
              </div>
            );
          }
          const bgColor = score !== undefined
            ? score >= AI_CONFIDENCE.high ? 'bg-emerald-500' : score >= AI_CONFIDENCE.medium ? 'bg-amber-500' : 'bg-red-500'
            : 'bg-gray-400';
          return (
            <button
              key={fdi}
              onClick={() => onSelect(isSelected ? null : fdi)}
              className={cn(
                'flex h-10 flex-col items-center justify-center rounded text-[9px] font-medium text-white transition-all',
                bgColor,
                isSelected && 'ring-2 ring-blue-400 ring-offset-1 scale-110',
              )}
              title={`${getToothName(fdi)}: ${score ? `${(score * 100).toFixed(0)}%` : '?'}`}
            >
              <span className="font-bold">{fdi}</span>
              <span>{score ? `${(score * 100).toFixed(0)}%` : '?'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
