// SupportPage.tsx — Support ticket list with create modal.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeadphonesIcon, Plus, MessageCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { supportService } from '../services/support.service';

const STATUS_CFG: Record<string, { variant: 'blue' | 'orange' | 'green' | 'default'; icon: typeof Clock }> = {
  OPEN: { variant: 'blue', icon: AlertCircle },
  IN_PROGRESS: { variant: 'orange', icon: Clock },
  RESOLVED: { variant: 'green', icon: CheckCircle },
  CLOSED: { variant: 'default', icon: CheckCircle },
};

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };

export function SupportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [category, setCategory] = useState('TECHNICAL');

  const { data, isLoading } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () => supportService.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => supportService.create({ subject, description, priority, category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      setShowCreate(false);
      setSubject(''); setDescription('');
    },
  });

  const tickets = data?.items ?? [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HeadphonesIcon className="h-5 w-5 text-slate-400" />
            <h1 className="text-2xl font-bold text-dark-text tracking-tight">Support</h1>
          </div>
          <p className="text-sm text-slate-500">Submit and track your support requests</p>
        </div>
        <Button variant="gradient" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Generate Ticket
        </Button>
      </motion.div>

      {/* Create Modal */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white border border-slate-200/60 shadow-card p-6">
          <h3 className="text-sm font-bold text-dark-text mb-4">New Support Ticket</h3>
          <div className="space-y-4">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
            <div className="grid grid-cols-2 gap-3">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-electric focus:outline-none">
                <option value="TECHNICAL">Technical</option>
                <option value="BILLING">Billing</option>
                <option value="CLINICAL">Clinical</option>
                <option value="OTHER">Other</option>
              </select>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-electric focus:outline-none">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your issue..."
              rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm resize-none focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10" />
            <div className="flex gap-2">
              <Button variant="gradient" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!subject || !description}>
                Submit Ticket
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : tickets.length === 0 ? (
        <motion.div variants={fadeUp} className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/60">
            <MessageCircle className="h-9 w-9 text-slate-300" />
          </div>
          <p className="text-base font-semibold text-dark-text">No tickets yet</p>
          <p className="text-sm text-slate-500">Click "Generate Ticket" to create your first support request.</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const cfg = STATUS_CFG[ticket.status] || STATUS_CFG.OPEN;
            return (
              <motion.div key={ticket.id} variants={fadeUp}
                onClick={() => navigate(`/support/${ticket.id}`)}
                className="rounded-2xl bg-white border border-slate-200/60 shadow-card p-5 cursor-pointer hover:shadow-card-hover transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{ticket.ticket_number}</span>
                    <Badge variant={cfg.variant} dot>{ticket.status.replace('_', ' ')}</Badge>
                    <Badge variant="default">{ticket.category}</Badge>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(ticket.created_at)}</span>
                </div>
                <h3 className="text-sm font-semibold text-dark-text">{ticket.subject}</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{ticket.description}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
