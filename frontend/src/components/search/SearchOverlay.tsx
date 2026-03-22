// SearchOverlay.tsx — Dropdown showing global search results.

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Users, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface SearchResult {
  cases: { id: string; case_number: string; status: string; treatment_type: string }[];
  patients: { id: string; first_name: string; last_name: string; patient_reference: string | null }[];
}

interface SearchOverlayProps {
  query: string;
  onClose: () => void;
}

export function SearchOverlay({ query, onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) { setResults(null); return; }
    setLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/cases/search', { params: { q: query } });
        setResults(res.data.data);
      } catch {
        setResults({ cases: [], patients: [] });
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasResults = results && (results.cases.length > 0 || results.patients.length > 0);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      {/* Dropdown */}
      <div className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl bg-white shadow-lg border border-gray-200 overflow-hidden max-h-80 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && !hasResults && query.length >= 2 && (
          <div className="py-6 text-center text-sm text-gray-500">No results found</div>
        )}

        {!loading && results && results.cases.length > 0 && (
          <div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cases</div>
            {results.cases.map((c) => (
              <button
                key={c.id}
                onClick={() => { navigate(`/cases/${c.id}`); onClose(); }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-soft-gray transition-colors"
              >
                <FolderOpen className="h-4 w-4 text-electric" />
                <span className="font-medium text-dark-text">{c.case_number}</span>
                <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                  {c.status}
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && results && results.patients.length > 0 && (
          <div>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 border-t border-gray-100">Patients</div>
            {results.patients.map((p) => (
              <button
                key={p.id}
                onClick={() => { onClose(); }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-soft-gray transition-colors"
              >
                <Users className="h-4 w-4 text-mint" />
                <span className="font-medium text-dark-text">{p.first_name} {p.last_name}</span>
                {p.patient_reference && (
                  <span className="text-xs text-gray-400">#{p.patient_reference}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
