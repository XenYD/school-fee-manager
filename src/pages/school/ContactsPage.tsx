import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Student } from '../../types'
import LoadingSpinner from '../../components/LoadingSpinner'
import { Phone, Search, MessageCircle, User, GraduationCap, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ContactEntry {
  studentId: string
  studentName: string
  studentClass: string
  parentName: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
}

export default function ContactsPage() {
  const { profile } = useAuth()
  const [contacts, setContacts] = useState<ContactEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const schoolId = profile?.role === 'admin' || profile?.role === 'demo'
    ? null  // admin sees all (could be filtered later)
    : profile?.school_id

  useEffect(() => { loadContacts() }, [profile])

  async function loadContacts() {
    try {
      let query = supabase
        .from('students')
        .select('id, name, class, parent_name, parent_phone, parent_whatsapp, address, school_id')
        .order('name')

      if (schoolId) query = query.eq('school_id', schoolId)

      const { data, error } = await query
      if (error) throw error

      const entries: ContactEntry[] = (data as Student[])
        .filter((s) => s.parent_phone || s.parent_name)
        .map((s) => ({
          studentId: s.id,
          studentName: s.name,
          studentClass: s.class,
          parentName: s.parent_name,
          phone: s.parent_phone,
          whatsapp: s.parent_whatsapp,
          address: s.address,
        }))

      setContacts(entries)
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      c.studentName.toLowerCase().includes(q) ||
      (c.parentName?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(q) ?? false)
    )
  }, [contacts, search])

  if (loading) return <LoadingSpinner fullPage text="Loading contacts..." />

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Parent Contacts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {contacts.length} contacts from admission records
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input className="input-field pl-9 text-sm" placeholder="Search by student name, parent name or phone..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card text-center">
          <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Contacts</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--c-accent)' }}>
            {contacts.filter((c) => c.phone).length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">With Phone</p>
        </div>
        <div className="stat-card text-center">
          <p className="text-2xl font-bold" style={{ color: '#2ECC71' }}>
            {contacts.filter((c) => c.whatsapp).length}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">On WhatsApp</p>
        </div>
      </div>

      {/* Contact List */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Phone size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {search ? `No contacts match "${search}"` : 'No contacts yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Parent contacts are populated from student admission forms
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <div key={c.studentId} className="card hover:shadow-md transition-shadow">
              {/* Student info */}
              <div className="flex items-center gap-2 mb-3 pb-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--c-accent), #2C5F8A)' }}>
                  {c.studentName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate text-gray-900">{c.studentName}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--c-text-4)' }}>
                    <GraduationCap size={11} /> {c.studentClass}
                  </p>
                </div>
              </div>

              {/* Parent info */}
              <div className="space-y-1.5">
                {c.parentName && (
                  <div className="flex items-center gap-2">
                    <User size={13} style={{ color: 'var(--c-text-4)' }} className="flex-shrink-0" />
                    <span className="text-sm text-gray-800 font-medium truncate">{c.parentName}</span>
                  </div>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`}
                    className="flex items-center gap-2 group">
                    <Phone size={13} style={{ color: 'var(--c-accent)' }} className="flex-shrink-0" />
                    <span className="text-sm font-medium group-hover:underline" style={{ color: 'var(--c-accent)' }}>
                      {c.phone}
                    </span>
                  </a>
                )}
                {c.whatsapp && c.whatsapp !== c.phone && (
                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 group">
                    <MessageCircle size={13} style={{ color: '#2ECC71' }} className="flex-shrink-0" />
                    <span className="text-sm font-medium group-hover:underline" style={{ color: '#2ECC71' }}>
                      {c.whatsapp}
                    </span>
                  </a>
                )}
                {c.whatsapp && c.whatsapp === c.phone && (
                  <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs rounded-md px-2 py-0.5 w-fit"
                    style={{ backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ECC71' }}>
                    <MessageCircle size={11} /> WhatsApp
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
