// org.service.ts — Organization API calls.

import api from '@/lib/api';
import type { ApiResponse } from '@/types/common';
import type { Organization, OrgInvite, OrgMember } from '../types/org.types';

async function getMyOrg(): Promise<Organization | null> {
  const res = await api.get<ApiResponse<Organization | null>>('/orgs/me');
  return res.data.data;
}

async function updateOrg(data: { name?: string; logo_url?: string }): Promise<Organization> {
  const res = await api.put<ApiResponse<Organization>>('/orgs/me', data);
  return res.data.data!;
}

async function listMembers(): Promise<OrgMember[]> {
  const res = await api.get<ApiResponse<OrgMember[]>>('/orgs/me/members');
  return res.data.data!;
}

async function removeMember(userId: string): Promise<void> {
  await api.delete(`/orgs/me/members/${userId}`);
}

async function sendInvite(data: { email: string; role: string }): Promise<OrgInvite> {
  const res = await api.post<ApiResponse<OrgInvite>>('/orgs/me/invites', data);
  return res.data.data!;
}

async function listInvites(): Promise<OrgInvite[]> {
  const res = await api.get<ApiResponse<OrgInvite[]>>('/orgs/me/invites');
  return res.data.data!;
}

async function revokeInvite(inviteId: string): Promise<void> {
  await api.delete(`/orgs/me/invites/${inviteId}`);
}

async function joinOrg(token: string): Promise<Organization> {
  const res = await api.post<ApiResponse<Organization>>('/orgs/join', { token });
  return res.data.data!;
}

export const orgService = {
  getMyOrg, updateOrg, listMembers, removeMember,
  sendInvite, listInvites, revokeInvite, joinOrg,
};
