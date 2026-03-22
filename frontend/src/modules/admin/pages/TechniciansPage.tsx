// TechniciansPage.tsx — Technician & Lab Manager management (filtered view).

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Wrench, UserPlus } from 'lucide-react';
import { adminService, type AdminUser } from '../services/admin.service';

const TECH_ROLES = ['TECHNICIAN', 'LAB_MANAGER'] as const;
const ROLE_COLORS: Record<string, string> = {
  TECHNICIAN: 'bg-green-100 text-green-700',
  LAB_MANAGER: 'bg-amber-100 text-amber-700',
};

export function TechniciansPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, _setPage] = useState(1);

  const effectiveRole = roleFilter || undefined;
  // Fetch technicians + lab managers by fetching both if no filter
  const { data: techData, isLoading: techLoading } = useQuery({
    queryKey: ['admin-techs', search, 'TECHNICIAN', page],
    queryFn: () => adminService.listUsers({ search, role: effectiveRole || 'TECHNICIAN', page, per_page: 50 }),
    enabled: !effectiveRole || effectiveRole === 'TECHNICIAN',
  });
  const { data: mgrData, isLoading: mgrLoading } = useQuery({
    queryKey: ['admin-techs', search, 'LAB_MANAGER', page],
    queryFn: () => adminService.listUsers({ search, role: 'LAB_MANAGER', page, per_page: 50 }),
    enabled: !effectiveRole,
  });

  const isLoading = techLoading || mgrLoading;

  // Merge results
  let users: AdminUser[] = [];
  if (effectiveRole) {
    users = (effectiveRole === 'TECHNICIAN' ? techData?.items : mgrData?.items) || [];
  } else {
    users = [...(techData?.items || []), ...(mgrData?.items || [])];
  }

  const statusMut = useMutation({
    mutationFn: (id: string) => adminService.toggleStatus(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-techs'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-techs'] }),
  });

  const handleDelete = (u: AdminUser) => {
    if (confirm(`Delete ${u.full_name}?`)) deleteMut.mutate(u.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-dark-text flex items-center gap-2">
          <Wrench className="h-6 w-6" /> Technicians
        </h1>
        <button
          onClick={() => alert('Invite feature coming soon')}
          className="flex items-center gap-2 rounded-lg bg-electric px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <UserPlus className="h-4 w-4" /> Invite Technician
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search technicians..."
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-dark-text"
        >
          <option value="">All</option>
          {TECH_ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="hidden md:block rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-soft-gray text-left">
              <th className="px-4 py-3 font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500">Specialization</th>
              <th className="px-4 py-3 font-medium text-gray-500">Experience</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No technicians found</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-dark-text">{u.full_name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                    {u.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{u.specialization || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{u.experience_years != null ? `${u.experience_years}y` : '—'}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => statusMut.mutate(u.id)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(u)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading...</p>}
        {users.map((u) => (
          <div key={u.id} className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-dark-text">{u.full_name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                {u.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-500">{u.email}</p>
            {u.specialization && <p className="text-xs text-gray-400 mt-1">Spec: {u.specialization}</p>}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => statusMut.mutate(u.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              >
                {u.is_active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => handleDelete(u)} className="ml-auto text-gray-400 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
