export interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
  user_name: string;
  created_at: string;
  updated_at: string;
  comments?: TicketComment[];
}

export interface TicketComment {
  id: string;
  message: string;
  attachment_url: string | null;
  is_staff_reply: boolean;
  author_name: string;
  created_at: string;
}
