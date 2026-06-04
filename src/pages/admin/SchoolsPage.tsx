import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { School } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { School as SchoolIcon, Plus, Trash2, ChevronRight, Phone, MapPin, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface SchoolForm {
  name: string
  address: string
  phone: string
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<SchoolForm>({ name: '', address: '', phone: '' })

  useEffect(() => { loadSchools() }, [])

  async function loadSchools() {
    try {
      const { data, error } = await supabase.from('schools').select('*').order('name')
      if (error) throw error
      setSchools(data ?? [])
    } catch {
      toast.error('Failed to load schools')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSchool(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('School name is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('schools').insert({
        name: form.name.trim(),
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      })
      if (error) throw error
      toast.success(`School "${form.name}" added successfully`)
      setShowModal(false)
      setForm({ name: '', address: '', phone: '' })
      loadSchools()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add school')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(school: School) {
    if (!confirm(`Delete "${school.name}"? This will also delete all students and fee records.`)) return
    setDeleting(school.id)
    try {
      const { error } = await supabase.from('schools').delete().eq('id', school.id)
      if (error) throw error
      toast.success(`School "${school.name}" deleted`)
      setSchools(schools.filter((s) => s.id !== school.id))
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete school')
    } finally {
      setDeleting(null)
    }
  }

  if (loading) return <LoadingSpinner fullPage text="Loading schools..." />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Schools</h1>
          <p className="text-sm text-gray-500 mt-0.5">{schools.length} school{schools.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
          <Plus size={16} />
          <span className="hidden sm:inline">Add School</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Schools Grid */}
      {schools.length === 0 ? (
        <div className="card text-center py-12">
          <SchoolIcon size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium text-lg">No schools yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first school to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-5 mx-auto">
            <Plus size={16} /> Add First School
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {schools.map((school) => (
            <div key={school.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SchoolIcon size={18} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{school.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Added {new Date(school.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(school)}
                    disabled={deleting === school.id}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    {deleting === school.id
                      ? <div className="h-4 w-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin" />
                      : <Trash2 size={16} />}
                  </button>
                </div>

                {(school.address || school.phone) && (
                  <div className="mt-3 space-y-1.5">
                    {school.address && (
                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <MapPin size={12} className="mt-0.5 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{school.address}</span>
                      </div>
                    )}
                    {school.phone && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Phone size={12} className="flex-shrink-0 text-gray-400" />
                        <span>{school.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Link
                to={`/admin/schools/${school.id}`}
                className="flex items-center justify-between px-4 sm:px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <span>Manage School</span>
                <ChevronRight size={16} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Add School Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-lg">Add New School</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSchool} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">School Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sunshine Public School"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="School address (optional)"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Contact number (optional)"
                  className="input-field"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? (
                    <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</>
                  ) : 'Add School'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
