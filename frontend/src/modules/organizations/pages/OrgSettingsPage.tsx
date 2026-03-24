// OrgSettingsPage.tsx — Organization settings with members and invite management.

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Users, Mail, Crown, Trash2, Send, CheckCircle,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/modules/auth';
import { useOrg } from '../hooks/useOrg';

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  SUPER_ADMIN: { bg: 'bg-red-50', text: 'text-red-700' },
  DENTIST: { bg: 'bg-blue-50', text: 'text-blue-700' },
  TECHNICIAN: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  LAB_MANAGER: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

export function OrgSettingsPage() {
  const { user } = useAuthStore();
  const {
    org, members, invites, isLoading,
    updateOrg, sendInvite, revokeInvite, removeMember, isInviting,
  } = useOrg();

  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DENTIST');
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Initialize form when org loads
  if (org && !orgName && !saving) {
    setOrgName(org.name);
  }

  const handleSaveOrg = async () => {
    if (!orgName.trim()) return;
    setSaving(true);
    await updateOrg({ name: orgName.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    try {
      const invite = await sendInvite({ email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail('');
      setInviteSuccess(`Invite sent to ${inviteEmail}. Token: ${invite.id}`);
      setTimeout(() => setInviteSuccess(''), 5000);
    } catch (err: any) {
      setInviteSuccess(err?.response?.data?.detail || 'Failed to send invite');
    }
  };

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>;

  if (!org) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Building2 className="h-12 w-12 text-slate-300" />
        <p className="text-lg font-semibold text-dark-text">No organization</p>
        <p className="text-sm text-slate-500">You are not part of any organization yet.</p>
      </div>
    );
  }

  const isOwner = user?.id === org.owner_id;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-dark-text tracking-tight">Organization</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your team and organization settings</p>
      </motion.div>

      {/* Org Info Card */}
      <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-electric/10 to-cyan-500/10">
            <Building2 className="h-5 w-5 text-electric" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-dark-text">General</h2>
            <p className="text-xs text-slate-400">Organization name and details</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Organization Name</label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={!isOwner}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm disabled:bg-slate-50 disabled:text-slate-400 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Slug</label>
              <input type="text" value={org.slug} disabled
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-400" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              Plan: <span className="font-semibold text-slate-600 capitalize">{org.plan_tier}</span>
              <span className="mx-2">|</span>
              Members: <span className="font-semibold text-slate-600">{org.member_count ?? members.length}</span>
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-3">
              <Button variant="gradient" onClick={handleSaveOrg} loading={saving}>
                {saved ? <><CheckCircle className="mr-1.5 h-4 w-4" /> Saved</> : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Invite Members */}
      {isOwner && (
        <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
              <UserPlus className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-dark-text">Invite Team Members</h2>
              <p className="text-xs text-slate-400">Send an invite link to add people to your organization</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@clinic.com"
                className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/10"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-electric focus:outline-none"
              >
                <option value="DENTIST">Dentist</option>
                <option value="TECHNICIAN">Technician</option>
                <option value="LAB_MANAGER">Lab Manager</option>
              </select>
              <Button variant="gradient" onClick={handleInvite} loading={isInviting}>
                <Send className="mr-1.5 h-4 w-4" /> Invite
              </Button>
            </div>
            {inviteSuccess && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-sm text-emerald-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> {inviteSuccess}
              </motion.p>
            )}

            {/* Pending invites */}
            {invites.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pending Invites</h3>
                <div className="space-y-2">
                  {invites.filter((inv) => inv.status === 'PENDING').map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span className="text-sm text-dark-text">{inv.email}</span>
                        <Badge variant="blue">{inv.role}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Expires {formatDate(inv.expires_at)}</span>
                        <button onClick={() => revokeInvite(inv.id)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Members List */}
      <motion.div variants={fadeUp} className="rounded-2xl bg-white border border-slate-200/60 shadow-card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
            <Users className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-dark-text">Team Members</h2>
            <p className="text-xs text-slate-400">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {members.map((member) => {
            const colors = ROLE_COLORS[member.role] || { bg: 'bg-slate-100', text: 'text-slate-600' };
            const initials = member.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
            const isSelf = member.id === user?.id;
            const isOrgOwner = member.id === org.owner_id;

            return (
              <div key={member.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-50 text-xs font-bold text-slate-600 border border-slate-200/60">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-dark-text">{member.full_name}</p>
                      {isOrgOwner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                      {isSelf && <span className="text-[10px] text-slate-400">(You)</span>}
                    </div>
                    <p className="text-xs text-slate-500">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold', colors.bg, colors.text)}>
                    {member.role.replace('_', ' ')}
                  </span>
                  {isOwner && !isOrgOwner && !isSelf && (
                    <button
                      onClick={() => removeMember(member.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
