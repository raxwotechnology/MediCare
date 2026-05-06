import { useState, useEffect } from 'react';
import { userService } from '../../services';
import { Modal, PageHeader, StatusBadge, Spinner, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiToggleRight, FiSearch } from 'react-icons/fi';

const ROLES = ['admin', 'receptionist', 'pharmacist', 'doctor', 'patient'];
const emailRoles = ['admin', 'receptionist', 'pharmacist'];

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'receptionist', password: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const r = await userService.getAll(roleFilter ? { role: roleFilter } : {});
      setUsers(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

  const openCreate = () => { setEditUser(null); setForm({ name: '', email: '', phone: '', role: 'receptionist', password: '' }); setShowModal(true); };
  const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, email: u.email || '', phone: u.phone || '', role: u.role, password: '' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editUser) {
        await userService.update(editUser._id, { name: form.name, email: form.email, phone: form.phone, ...(form.password && { password: form.password }) });
        toast.success('User updated');
      } else {
        await userService.create(form);
        toast.success('User created');
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setSaving(false); }
  };

  const handleToggle = async (u) => {
    try {
      await userService.toggle(u._id);
      toast.success(`User ${u.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Error'); }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  const isEmailRole = emailRoles.includes(form.role);

  return (
    <div>
      <PageHeader title="Manage Users" subtitle="Create and manage all system users"
        action={<button onClick={openCreate} className="btn-primary flex items-center gap-2"><FiPlus size={16} />Add User</button>} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field sm:w-40">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Contact</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0
                ? <tr><td colSpan={5}><EmptyState message="No users found" /></td></tr>
                : filtered.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
                          {u.name?.charAt(0)}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="text-gray-500">{u.email || u.phone}</td>
                    <td><span className="badge badge-blue capitalize">{u.role}</span></td>
                    <td><StatusBadge status={u.isActive ? 'active' : 'inactive'} /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-gray-400 hover:text-primary-600 p-1.5 rounded hover:bg-primary-50 transition"><FiEdit2 size={15} /></button>
                        <button onClick={() => handleToggle(u)} className={`p-1.5 rounded transition text-sm ${u.isActive ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}>
                          <FiToggleRight size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editUser ? 'Edit User' : 'Create User'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required />
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          {isEmailRole
            ? <div><label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" required={!editUser} /></div>
            : <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" required={!editUser} /></div>
          }
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="input-field" required={!editUser} minLength={6} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
