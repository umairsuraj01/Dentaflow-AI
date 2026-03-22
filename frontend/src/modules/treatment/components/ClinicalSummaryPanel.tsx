// ClinicalSummaryPanel.tsx — Doctor review panel with clinical summary and report.

import { useState } from 'react';
import { Loader2, FileText, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { analysisService } from '../services/analysis.service';
import type {
  ClinicalSummaryResult,
  TreatmentReportData,
} from '../types/analysis.types';
import type { ToothTransform } from '../types/treatment.types';

interface ClinicalSummaryPanelProps {
  filePath: string;
  jaw?: string;
  extractionId?: string;
  targets: Record<number, ToothTransform>;
}

export function ClinicalSummaryPanel({ filePath, jaw, extractionId, targets }: ClinicalSummaryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ClinicalSummaryResult | null>(null);
  const [report, setReport] = useState<TreatmentReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const buildTargetsDict = (): Record<string, Record<string, number>> | undefined => {
    if (Object.keys(targets).length === 0) return undefined;
    const dict: Record<string, Record<string, number>> = {};
    for (const [fdi, t] of Object.entries(targets)) {
      dict[fdi] = {
        pos_x: t.pos_x, pos_y: t.pos_y, pos_z: t.pos_z,
        rot_x: t.rot_x, rot_y: t.rot_y, rot_z: t.rot_z,
      };
    }
    return dict;
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const targetsDict = buildTargetsDict();

      const [summaryRes, reportRes] = await Promise.all([
        analysisService.getClinicalSummary({
          filePath,
          jaw,
          extractionId,
          targets: targetsDict,
          format: 'text',
        }),
        analysisService.generateReport({
          filePath,
          jaw,
          extractionId,
          targets: targetsDict,
        }),
      ]);

      setSummary(summaryRes);
      setReport(reportRes);
      // Auto-expand first section
      if (summaryRes.sections.length > 0) {
        setExpandedSections(new Set([summaryRes.sections[0].heading]));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (heading: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(heading)) next.delete(heading);
      else next.add(heading);
      return next;
    });
  };

  const downloadReport = () => {
    if (!summary?.text) return;
    const blob = new Blob([summary.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treatment-summary-${jaw ?? 'arch'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Clinical Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            Generate a doctor-ready clinical summary with treatment recommendations.
          </p>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <Button size="sm" className="w-full" onClick={generate} disabled={loading}>
            {loading ? (
              <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Generating...</>
            ) : (
              <><FileText className="mr-1 h-3.5 w-3.5" />Generate Summary</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            {summary.title}
            <div className="flex gap-1">
              {report && (
                <Badge variant={
                  report.difficulty_rating === 'simple' ? 'green' :
                  report.difficulty_rating === 'moderate' ? 'orange' : 'red'
                }>
                  {report.difficulty_rating}
                </Badge>
              )}
              {summary.text && (
                <button
                  onClick={downloadReport}
                  className="rounded p-1 hover:bg-gray-100"
                  title="Download summary"
                >
                  <Download className="h-3.5 w-3.5 text-gray-400" />
                </button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-gray-600">{summary.overall_assessment}</p>
          <div className="flex justify-between text-gray-500">
            <span>Duration</span>
            <span className="font-medium">{summary.estimated_duration}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Complexity</span>
            <span className="font-medium">{summary.complexity}</span>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      {summary.sections.map((section) => {
        const isExpanded = expandedSections.has(section.heading);
        return (
          <Card key={section.heading}>
            <button
              onClick={() => toggleSection(section.heading)}
              className="flex w-full items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm font-semibold text-gray-700">{section.heading}</span>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {isExpanded && (
              <CardContent className="pt-0 space-y-1.5 text-xs">
                <p className="text-gray-600">{section.content}</p>
                {section.findings.length > 0 && (
                  <div className="space-y-0.5">
                    {section.findings.map((f, i) => (
                      <p key={i} className="text-gray-500 pl-2 border-l-2 border-gray-200">{f}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Treatment Goals */}
      {summary.treatment_goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Treatment Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
              {summary.treatment_goals.map((goal, i) => (
                <li key={i}>{goal}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report && report.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {report.recommendations.map((rec, i) => (
                <p key={i} className="text-gray-600 pl-2 border-l-2 border-blue-200">{rec}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {report && report.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-amber-600">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              {report.warnings.map((w, i) => (
                <p key={i} className="text-amber-700">{w}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regenerate */}
      <Button size="sm" variant="outline" className="w-full" onClick={generate} disabled={loading}>
        {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
        Regenerate Summary
      </Button>
    </div>
  );
}
