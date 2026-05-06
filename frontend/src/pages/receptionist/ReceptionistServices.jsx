import { useState, useEffect } from 'react';
import { serviceService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

export default function ReceptionistServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    setLoading(true);
    const r = await serviceService.getAll();
    setServices(r.data);
    setLoading(false);
  };
  useEffect(() => { fetchServices(); }, []);

  const openCreate = () => {
    setEditSvc(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  };

  const openEdit = (svc) => {
    setEditSvc(svc);
    setForm({ name: svc.name || '', description: svc.description || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editSvc) {
        await serviceService.update(editSvc._id, form);
        toast.success('Service updated');
      } else {
        await serviceService.create(form);
        toast.success('Service created');
      }
      setShowModal(false);
      fetchServices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Services"
        subtitle="Manage available clinic services"
        action={
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <FiPlus size={16} />Add Service
          </button>
        }
      />

      {loading ? <Spinner /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.length === 0 ? <EmptyState message="No services found" /> : services.map(svc => (
            <div key={svc._id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
                  {svc.name?.charAt(0)}
                </div>
                <button
                  onClick={() => openEdit(svc)}
                  title="Edit service"
                  className="text-gray-400 hover:text-primary-600 p-1.5 rounded hover:bg-primary-50 transition"
                >
                  <FiEdit2 size={15} />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900">{svc.name}</h3>
              {svc.description && <p className="text-sm text-gray-500">{svc.description}</p>}
              <span className={`badge w-fit ${svc.isActive !== false ? 'badge-green' : 'badge-yellow'}`}>
                {svc.isActive !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editSvc ? 'Edit Service' : 'Create Service'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
            <input
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field"
              required
              placeholder="e.g. Consultation"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Optional description…"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : (editSvc ? 'Save Changes' : 'Create Service')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
