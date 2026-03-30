// TicketDetailPage.tsx — Ticket detail with conversation thread.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { supportService } from '../services/support.service';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => supportService.getById(id!),
    enabled: !!id,
  });

  const commentMutation = useMutation({
    mutationFn: () => supportService.addComment(id!, { message }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      setMessage('');
    },
  });

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;
  if (!ticket) return <p className="text-center py-24 text-slate-500">Ticket not found</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link to="/support" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-electric mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Support
        </Link>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-dark-text">{ticket.subject}</h1>
          <Badge variant={ticket.status === 'OPEN' ? 'blue' : ticket.status === 'RESOLVED' ? 'green' : 'orange'} dot>
            {ticket.status.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{ticket.ticket_number}</span>
          <span>&middot;</span>
          <span>{ticket.category}</span>
          <span>&middot;</span>
          <span>{formatDate(ticket.created_at)}</span>
        </div>
      </div>

      {/* Original description */}
      <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-dark-text">{ticket.user_name}</p>
            <p className="text-[10px] text-slate-400">{formatDate(ticket.created_at)}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{ticket.description}</p>
      </div>

      {/* Comments thread */}
      {ticket.comments && ticket.comments.length > 0 && (
        <div className="space-y-3">
          {ticket.comments.map((comment) => (
            <div key={comment.id} className={cn(
              'rounded-2xl border p-4',
              comment.is_staff_reply
                ? 'bg-blue-50/50 border-blue-200/60 ml-6'
                : 'bg-white border-slate-200/60 mr-6',
            )}>
              <div className="flex items-center gap-2 mb-2">
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                  comment.is_staff_reply ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-600',
                )}>
                  {comment.author_name.charAt(0)}
                </div>
                <span className="text-xs font-semibold text-dark-text">{comment.author_name}</span>
                {comment.is_staff_reply && <Badge variant="blue">Staff</Badge>}
                <span className="text-[10px] text-slate-400 ml-auto">{formatDate(comment.created_at)}</span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{comment.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      {ticket.status !== 'CLOSED' && (
        <div className="rounded-2xl bg-white border border-slate-200/60 shadow-card p-4">
          <div className="flex gap-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm resize-none focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
            />
          </div>
          <div className="flex justify-end mt-3">
            <Button variant="gradient" onClick={() => commentMutation.mutate()} loading={commentMutation.isPending} disabled={!message.trim()}>
              <Send className="mr-1.5 h-4 w-4" /> Reply
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
