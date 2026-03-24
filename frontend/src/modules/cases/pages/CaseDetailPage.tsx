// CaseDetailPage.tsx — Case detail with tabbed layout (Overview, Files, Instructions, 3D, Notes).

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, Eye, Cuboid, ClipboardList, Send, Move3d } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/modules/auth';
import { useCaseDetail } from '../hooks/useCaseDetail';
import { CaseStatusBadge } from '../components/CaseStatusBadge';
import { CasePriorityBadge } from '../components/CasePriorityBadge';
import { ToothInstructionPanel } from '@/modules/tooth-instructions/components/ToothInstructionPanel';
import { useToothInstructions } from '@/modules/tooth-instructions/hooks/useToothInstructions';
import { Link } from 'react-router-dom';
import { DentalViewer3D } from '@/modules/viewer/components/DentalViewer3D';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'instructions', label: 'Instructions', icon: ClipboardList },
  { id: 'viewer', label: '3D Viewer', icon: Cuboid },
  { id: 'treatment', label: 'Treatment', icon: Move3d },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { caseData, isLoading, approve, requestRevision, addNote } = useCaseDetail(id);
  const { instructions, addInstruction, removeInstruction } = useToothInstructions({ caseId: id });
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [noteText, setNoteText] = useState('');
  const [revisionReason, _setRevisionReason] = useState('');

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (!caseData) {
    return <div className="py-20 text-center text-gray-500">Case not found</div>;
  }

  const canEditRole = ['DENTIST', 'SUPER_ADMIN'].includes(user?.role || '');
  const canEdit = canEditRole && ['DRAFT', 'SUBMITTED'].includes(caseData.status);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    await addNote({ note_text: noteText });
    setNoteText('');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">{caseData.case_number}</h1>
          <div className="mt-1 flex items-center gap-2">
            <CaseStatusBadge status={caseData.status} />
            <CasePriorityBadge priority={caseData.priority} />
            {caseData.managed_by_platform && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/10">
                Managed by DentaFlow
              </span>
            )}
          </div>
        </div>
        {canEditRole && caseData.status === 'REVIEW' && (
          <div className="flex gap-2">
            <Button variant="mint" onClick={() => approve()}>Approve</Button>
            <Button variant="outline" onClick={() => {
              if (revisionReason) requestRevision(revisionReason);
            }}>Request Revision</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg bg-soft-gray p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id ? 'bg-white text-dark-text shadow-sm' : 'text-gray-500 hover:text-dark-text',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Case Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-y-3 text-sm">
                  <span className="text-gray-500">Treatment:</span>
                  <span>{caseData.treatment_type.replace(/_/g, ' ')}</span>
                  <span className="text-gray-500">Priority:</span>
                  <span><CasePriorityBadge priority={caseData.priority} /></span>
                  <span className="text-gray-500">Price:</span>
                  <span className="font-semibold">${caseData.price_usd?.toFixed(2) ?? '—'}</span>
                  <span className="text-gray-500">Due Date:</span>
                  <span>{caseData.due_date ? formatDateTime(caseData.due_date) : '—'}</span>
                  <span className="text-gray-500">Submitted:</span>
                  <span>{caseData.submitted_at ? formatDateTime(caseData.submitted_at) : '—'}</span>
                </div>
                {caseData.chief_complaint && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-500">Chief Complaint</p>
                    <p className="mt-1 text-sm">{caseData.chief_complaint}</p>
                  </div>
                )}
                {caseData.treatment_goals && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-500">Treatment Goals</p>
                    <p className="mt-1 text-sm">{caseData.treatment_goals}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <TimelineItem label="Created" date={caseData.created_at} />
                  {caseData.submitted_at && <TimelineItem label="Submitted" date={caseData.submitted_at} />}
                  {caseData.completed_at && <TimelineItem label="Completed" date={caseData.completed_at} />}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <Card>
            <CardHeader><CardTitle>Files ({caseData.files.length})</CardTitle></CardHeader>
            <CardContent>
              {caseData.files.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No files uploaded</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {caseData.files.map((f) => (
                    <div key={f.id} className="rounded-lg border border-gray-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <FileText className="h-8 w-8 text-gray-400" />
                        {f.is_ai_processed && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            AI Done
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium">{f.original_filename}</p>
                      <p className="text-xs text-gray-500">{(f.file_size_bytes / 1024).toFixed(0)} KB</p>
                      {['stl', 'obj', 'ply'].includes(f.file_format?.toLowerCase() ?? '') && (
                        <Link
                          to={`/cases/${caseData.id}/treatment`}
                          className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-800"
                        >
                          <Move3d className="h-3 w-3" />
                          Open in Treatment Planner
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions Tab */}
        {activeTab === 'instructions' && (
          <Card>
            <CardHeader><CardTitle>Tooth Instructions</CardTitle></CardHeader>
            <CardContent>
              <ToothInstructionPanel
                instructions={instructions}
                onAdd={(data) => addInstruction(data)}
                onRemove={(idOrIndex) => removeInstruction(idOrIndex)}
                disabled={!canEdit}
              />
            </CardContent>
          </Card>
        )}

        {/* 3D Viewer Tab */}
        {activeTab === 'viewer' && (
          <DentalViewer3D />
        )}

        {/* Treatment Tab — single entry point for AI + treatment planning */}
        {activeTab === 'treatment' && (
          <Card>
            <CardHeader><CardTitle>Treatment Planning</CardTitle></CardHeader>
            <CardContent className="text-center py-8">
              <Move3d className="mx-auto mb-3 h-12 w-12 text-emerald-400" />
              <p className="mb-3 text-sm text-gray-500">
                AI segments your scan into gum and teeth, then you can review, edit boundaries, and plan tooth movements.
              </p>
              <div className="flex items-center justify-center gap-6 mb-5 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">1</span>
                  AI Segmentation
                </div>
                <span>&rarr;</span>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">2</span>
                  Review & Edit
                </div>
                <span>&rarr;</span>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">3</span>
                  Treatment Plan
                </div>
              </div>
              <Link
                to={`/cases/${caseData.id}/treatment`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Move3d className="h-4 w-4" />
                Open Treatment Planner
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <Card>
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 max-h-96 space-y-3 overflow-y-auto scrollbar-thin">
                {caseData.notes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-400">No notes yet</p>
                ) : (
                  caseData.notes.map((note) => {
                    const isOwn = note.author_id === user?.id;
                    return (
                      <div key={note.id} className={cn('max-w-[80%] rounded-xl p-3', isOwn ? 'ml-auto bg-electric/10' : 'bg-soft-gray')}>
                        <p className="text-sm">{note.note_text}</p>
                        <p className="mt-1 text-[10px] text-gray-400">{formatDateTime(note.created_at)}</p>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  placeholder="Type a note..."
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-electric focus:outline-none"
                />
                <Button size="icon" onClick={handleAddNote}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-electric" />
      <div>
        <p className="text-sm font-medium text-dark-text">{label}</p>
        <p className="text-xs text-gray-500">{formatDateTime(date)}</p>
      </div>
    </div>
  );
}
