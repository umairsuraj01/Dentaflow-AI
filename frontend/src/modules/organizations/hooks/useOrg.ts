// useOrg.ts — Hooks for organization queries and mutations.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgService } from '../services/org.service';

export function useOrg() {
  const queryClient = useQueryClient();

  const orgQuery = useQuery({
    queryKey: ['my-org'],
    queryFn: () => orgService.getMyOrg(),
  });

  const membersQuery = useQuery({
    queryKey: ['org-members'],
    queryFn: () => orgService.listMembers(),
    enabled: !!orgQuery.data,
  });

  const invitesQuery = useQuery({
    queryKey: ['org-invites'],
    queryFn: () => orgService.listInvites(),
    enabled: !!orgQuery.data,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; logo_url?: string }) => orgService.updateOrg(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-org'] }),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => orgService.sendInvite(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-invites'] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => orgService.revokeInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-invites'] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => orgService.removeMember(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-members'] }),
  });

  return {
    org: orgQuery.data,
    members: membersQuery.data ?? [],
    invites: invitesQuery.data ?? [],
    isLoading: orgQuery.isLoading,
    updateOrg: updateMutation.mutateAsync,
    sendInvite: inviteMutation.mutateAsync,
    revokeInvite: revokeMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
  };
}
