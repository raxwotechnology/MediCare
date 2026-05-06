import { useState, useEffect } from 'react';
import { serviceService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function ManageServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetch = async () => { setLoading(true); const r = await serviceService.getAll(); setServices(r.data); setLoading(false); };
  useEffect(() => { fetch(); }, []);

  const open = (svc = null) => { setEditSvc(svc); setForm({ name: svc?.name || '', description: svc?.description || '' }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editSvc) await serviceService.update(editSvc._id, form);
      else await serviceService.create(form);
      toast.success(editSvc ? 'Service updated' : 'Service created');
      setShowModal(false); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this service?')) return;
    try { await serviceService.delete(id); toast.success('Service deactivated'); fetch(); }
    catch { toast.error('Error'); }
  };

  return (
    <div>
      <PageHeader title="Manage Services" subtitle="Define clinic services"
        action={<button onClick={() => open()} className="btn-primary flex items-center gap-2"><FiPlus size={16} />Add Service</button>} />

      {loading ? <Spinner /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.length === 0 ? <EmptyState message="No services yet" /> : services.map(svc => (
            <div key={svc._id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                  {svc.name?.charAt(0)}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => open(svc)} className="text-gray-400 hover:text-primary-600 p-1.5 rounded hover:bg-primary-50 transition"><FiEdit2 size={15} /></button>
                  <button onClick={() => handleDelete(svc._id)} className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition"><FiTrash2 size={15} /></button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{svc.name}</h3>
              {svc.description && <p className="text-sm text-gray-500">{svc.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editSvc ? 'Edit Service' : 'Create Service'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
