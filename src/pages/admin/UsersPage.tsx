import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Profile, School, UserRole } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  Users, Save, X, Shield, UserCheck, GraduationCap,
  Search, AlertTriangle, Building2, ChevronDown, CheckCircle2,
  RefreshCw, Info, Eye, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  admin:        { label: 'Admin',     color: 'text-purple-700', bg: 'bg-purple-100', icon: <Shield size={13} /> },
  school_owner: { label: 'Principal', color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <UserCheck size={13} /> },
  staff:        { label: 'Staff',     color: 'text-green-700',  bg: 'bg-green-100',  icon: <GraduationCap size={13} /> },
  demo:         { label: 'Demo',      color: 'text-orange-700', bg: 'bg-orange-100', icon: <Eye size={13} /> },
}

interface EditState {
  role: UserRole
  school_id: string
}

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [editMap, setEditMap] = useState<Record<string, EditState>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData(silent = false) {
    if (silent) setRefreshing(true)
    else setLoading(true)
    try {
      const [{ data: profilesData, error: p }, { data: schoolsData, error: s }] = await Promise.all([
        supabase.from('profiles').select('*, schools(*)').order('full_name'),
        supabase.from('schools').select('*').order('name'),
      ])
      if (p) throw p
      if (s) throw s
      setProfiles(profilesData ?? [])
      setSchools(schoolsData ?? [])
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function startEdit(profile: Profile) {
    setEditMap((prev) => ({
      ...prev,
      [profile.id]: { role: profile.role, school_id: profile.school_id ?? '' },
    }))
  }

  function cancelEdit(profileId: string) {
    setEditMap((prev) => {
      const next = { ...prev }
      delete next[profileId]
      return next
    })
  }

  function updateEdit(profileId: string, patch: Partial<EditState>) {
    setEditMap((prev) => ({
      ...prev,
      [profileId]: { ...prev[profileId], ...patch },
    }))
  }

  function isDirty(profile: Profile) {
    const edit = editMap[profile.id]
    if (!edit) return false
    return edit.role !== profile.role || edit.school_id !== (profile.school_id ?? '')
  }

  async function saveUser(profile: Profile) {
    const edit = editMap[profile.id]
    if (!edit) return
    setSavingId(profile.id)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: edit.role, school_id: edit.school_id || null })
        .eq('id', profile.id)
      if (error) throw error
      toast.success(`${profile.full_name} updated`)
      cancelEdit(profile.id)
      loadData(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteUser(profile: Profile) {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profile.id)
      if (error) throw error
      toast.success(`${profile.full_name} removed`)
      setConfirmDelete(null)
      loadData(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Remove failed')
    } finally {
      setDeleting(false)
    }
  }

  const unassignedCount = profiles.filter((p) => !p.school_id && p.role !== 'admin' && p.role !== 'demo').length

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        p.full_name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.schools?.name?.toLowerCase().includes(q)
    )
  }, [profiles, search])

  if (loading) return <LoadingSpinner fullPage text="Loading users..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Assign roles and schools to everyone who signs up
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="btn-secondary text-sm"
          title="Refresh list"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800 space-y-1">
          <p className="font-semibold">How to onboard new staff or principals</p>
          <ol className="list-decimal list-inside text-xs space-y-0.5 text-indigo-700">
            <li>Share the <code className="bg-indigo-100 px-1 rounded font-mono">/signup</code> link with the new user</li>
            <li>They register — their default role is Staff with no school</li>
            <li>Find them below, set their Role and School, then click Save</li>
          </ol>
        </div>
      </div>

      {/* Unassigned warning */}
      {unassignedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {unassignedCount} user{unassignedCount !== 1 ? 's' : ''} not yet assigned to a school
          </p>
        </div>
      )}

      {/* Search */}
      {profiles.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or school..."
            className="input-field pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* User List */}
      {profiles.length === 0 ? (
        <div className="card text-center py-14">
          <Users size={44} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No users yet</p>
          <p className="text-sm text-gray-400 mt-1">Users will appear here once they sign up</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <Search size={28} className="text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No users match "{search}"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((profile) => {
            const isEditing = !!editMap[profile.id]
            const edit = editMap[profile.id]
            const rc = ROLE_CONFIG[profile.role]
            const isSaving = savingId === profile.id
            const isUnassigned = !profile.school_id && profile.role !== 'admin' && profile.role !== 'demo'
            const dirty = isDirty(profile)

            return (
              <div
                key={profile.id}
                className={`bg-white rounded-xl border transition-all ${
                  isEditing ? 'border-indigo-300 shadow-md shadow-indigo-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* User Row */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${rc.bg} ${rc.color}`}>
                    {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{profile.full_name}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${rc.bg} ${rc.color}`}>
                        {rc.icon} {rc.label}
                      </span>
                      {isUnassigned && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          <AlertTriangle size={10} /> Unassigned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{profile.email}</p>
                    {profile.schools && (
                      <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                        <Building2 size={11} /> {profile.schools.name}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(profile)}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <ChevronDown size={14} /> Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(profile)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove user"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Edit Panel */}
                {isEditing && (
                  <div className="px-4 pb-4 border-t border-indigo-100 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {/* Role */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Role
                        </label>
                        <div className="flex gap-2">
                          {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([key, cfg]) => (
                            <button
                              key={key}
                              onClick={() => updateEdit(profile.id, { role: key })}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                                edit.role === key
                                  ? `border-current ${cfg.bg} ${cfg.color}`
                                  : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
                              }`}
                            >
                              {cfg.icon}
                              <span className="hidden xs:inline sm:hidden md:inline">{cfg.label}</span>
                              {edit.role === key && <CheckCircle2 size={12} className="hidden sm:inline" />}
                            </button>
                          ))}
                        </div>
                        {/* role label below buttons on small screens */}
                        <p className={`text-xs font-medium mt-1.5 ${ROLE_CONFIG[edit.role].color}`}>
                          Selected: <span className="font-bold">{ROLE_CONFIG[edit.role].label}</span>
                        </p>
                      </div>

                      {/* School */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          School
                        </label>
                        <div className="relative">
                          <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <select
                            value={edit.school_id}
                            onChange={(e) => updateEdit(profile.id, { school_id: e.target.value })}
                            className="input-field pl-8 text-sm appearance-none cursor-pointer"
                          >
                            <option value="">— No school assigned —</option>
                            {schools.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        {(edit.role === 'admin' || edit.role === 'demo') && (
                          <p className="text-xs text-amber-600 mt-1">
                            {edit.role === 'demo' ? 'Demo users can browse all schools — no school assignment needed' : 'Admins can see all schools — school assignment is optional'}
                          </p>
                        )}
                        {edit.role !== 'admin' && edit.role !== 'demo' && !edit.school_id && (
                          <p className="text-xs text-red-500 mt-1">This user won't be able to access any school data</p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => cancelEdit(profile.id)}
                        disabled={isSaving}
                        className="btn-secondary text-sm py-2 px-4"
                      >
                        <X size={14} /> Cancel
                      </button>
                      <button
                        onClick={() => saveUser(profile)}
                        disabled={isSaving || !dirty}
                        className={`btn-primary text-sm py-2 px-5 ${!dirty && !isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSaving ? (
                          <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                        ) : (
                          <><Save size={14} /> Save Changes</>
                        )}
                      </button>
                      {!dirty && !isSaving && (
                        <p className="text-xs text-gray-400 ml-1">No changes made</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Remove User Confirmation Modal ─────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="modal-box w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Remove User</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action cannot be undone</p>
              </div>
              <button
                onClick={() => setConfirmDelete(null)}
                className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-800">
                Are you sure you want to remove{' '}
                <span className="font-bold">{confirmDelete.full_name}</span>?
              </p>
              <p className="text-xs text-red-600 mt-1">
                {confirmDelete.email}
              </p>
              <p className="text-xs text-red-600 mt-2">
                Their account will be removed from the app. They won't be able to log in until re-added.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="btn-secondary flex-1 text-sm py-2"
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-60"
              >
                {deleting ? (
                  <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Removing...</>
                ) : (
                  <><Trash2 size={14} /> Remove User</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary footer */}
      {profiles.length > 0 && (
        <div className="flex items-center justify-between px-1 text-xs text-gray-400">
          <span>{profiles.length} registered user{profiles.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-3">
            {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([key, cfg]) => {
              const count = profiles.filter((p) => p.role === key).length
              if (!count) return null
              return (
                <span key={key} className={`flex items-center gap-1 font-medium ${cfg.color}`}>
                  {cfg.icon} {count} {cfg.label}{count !== 1 ? 's' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
