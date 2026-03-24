// org.types.ts — TypeScript interfaces for organizations.

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  logo_url: string | null;
  plan_tier: string;
  is_active: boolean;
  created_at: string;
  member_count: number | null;
}

export interface OrgInvite {
  id: string;
  org_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  org_name: string | null;
}

export interface OrgMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  joined_at: string | null;
}
