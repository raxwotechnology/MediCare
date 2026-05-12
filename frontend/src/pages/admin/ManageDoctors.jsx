import { useState, useEffect } from 'react';
import { doctorService, serviceService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState, CreatableSelect } from '../../components/common';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiChevronDown, FiClock, FiX, FiUser, FiList } from 'react-icons/fi';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_ABBR = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
const TABS = ['Profile', 'Services', 'Schedule'];

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [expandedDoctor, setExpandedDoctor] = useState(null);

  const [form, setForm] = useState({ designation: 'Dr.', name: '', phone: '', specialization: '', slmcNumber: '' });
  const [activeTab, setActiveTab] = useState('Profile');
  const [saving, setSaving] = useState(false);

  // Pending services/slots for new doctor creation
  const [pendingServices, setPendingServices] = useState([]);
  const [newSvcForm, setNewSvcForm] = useState({ serviceId: '', price: '', doctorFee: '' });
  const [pendingSlots, setPendingSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '17:00' });

  // Service modal for existing doctors
  const [serviceForm, setServiceForm] = useState({ serviceId: '', price: '', doctorFee: '' });
  const [isEditingService, setIsEditingService] = useState(false);

  // Availability modal for existing doctors
  const [availabilityDoctor, setAvailabilityDoctor] = useState(null);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [newAvailSlot, setNewAvailSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '17:00' });
  const [savingAvailability, setSavingAvailability] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [dr, sv] = await Promise.all([doctorService.getAll(), serviceService.getAll()]);
    const freshDoctors = dr.data;
    setDoctors(freshDoctors);
    setServices(sv.data);
    setExpandedDoctor(prev => prev ? (freshDoctors.find(d => d._id === prev._id) || null) : null);
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openCreateModal = () => {
    setSelectedDoctor(null);
    setForm({ designation: 'Dr.', name: '', phone: '', specialization: '', slmcNumber: '' });
    setPendingServices([]);
    setPendingSlots([]);
    setNewSvcForm({ serviceId: '', price: '', doctorFee: '' });
    setNewSlot({ day: 'Monday', startTime: '09:00', endTime: '17:00' });
    setActiveTab('Profile');
    setShowModal(true);
  };

  const openEditModal = (doc) => {
    setSelectedDoctor(doc);
    setForm({ designation: doc.designation || 'Dr.', name: doc.name, phone: doc.phone, specialization: doc.specialization || '', slmcNumber: doc.slmcNumber || '' });
    setActiveTab('Profile');
    setShowModal(true);
  };

  const addPendingService = () => {
    if (!newSvcForm.serviceId || !newSvcForm.price || !newSvcForm.doctorFee) {
      toast.error('Select a service and enter both prices'); return;
    }
    if (pendingServices.find(s => s.serviceId === newSvcForm.serviceId)) {
      toast.error('Service already added'); return;
    }
    const label = newSvcForm.serviceId.startsWith('__new__:')
      ? newSvcForm.serviceId.replace('__new__:', '').trim()
      : services.find(s => s._id === newSvcForm.serviceId)?.name || newSvcForm.serviceId;
    setPendingServices(prev => [...prev, { serviceId: newSvcForm.serviceId, price: newSvcForm.price, doctorFee: newSvcForm.doctorFee, label }]);
    setNewSvcForm({ serviceId: '', price: '', doctorFee: '' });
  };

  const addPendingSlot = () => {
    if (newSlot.startTime >= newSlot.endTime) { toast.error('End time must be after start time'); return; }
    if (pendingSlots.find(s => s.day === newSlot.day && s.startTime === newSlot.startTime && s.endTime === newSlot.endTime)) {
      toast.error('Slot already exists'); return;
    }
    setPendingSlots(prev => [...prev, { ...newSlot }]);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (selectedDoctor) {
        await doctorService.update(selectedDoctor._id, form);
        toast.success('Doctor updated');
      } else {
        const res = await doctorService.create(form);
        const newDoctorId = res.data._id;
        for (const svc of pendingServices) {
          let serviceId = svc.serviceId;
          if (serviceId.startsWith('__new__:')) {
            const created = await serviceService.create({ name: serviceId.replace('__new__:', '').trim() });
            serviceId = created.data._id;
          }
          await doctorService.addService(newDoctorId, { serviceId, price: Number(svc.price), doctorFee: Number(svc.doctorFee) });
        }
        if (pendingSlots.length > 0) {
          await doctorService.updateAvailability(newDoctorId, { availability: pendingSlots });
        }
        const parts = ['Doctor created'];
        if (pendingServices.length) parts.push(`${pendingServices.length} service(s) assigned`);
        if (pendingSlots.length) parts.push(`schedule set`);
        toast.success(parts.join(' · '));
      }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleSaveService = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      let serviceId = serviceForm.serviceId;
      if (serviceId && serviceId.startsWith('__new__:')) {
        const created = await serviceService.create({ name: serviceId.replace('__new__:', '').trim() });
        serviceId = created.data._id;
        const sv = await serviceService.getAll();
        setServices(sv.data);
      }
      if (isEditingService) {
        await doctorService.updateService(expandedDoctor._id, serviceForm.serviceId, { price: Number(serviceForm.price), doctorFee: Number(serviceForm.doctorFee) });
        toast.success('Service updated');
      } else {
        await doctorService.addService(expandedDoctor._id, { serviceId, price: Number(serviceForm.price), doctorFee: Number(serviceForm.doctorFee) });
        toast.success('Service added');
      }
      setShowServiceModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleRemoveService = async (doctorId, serviceId) => {
    if (!confirm('Remove this service?')) return;
    try { await doctorService.removeService(doctorId, serviceId); toast.success('Service removed'); fetchData(); }
    catch { toast.error('Error'); }
  };

  const openAvailabilityModal = (doc) => {
    setAvailabilityDoctor(doc);
    setAvailabilitySlots(doc.availability ? [...doc.availability] : []);
    setNewAvailSlot({ day: 'Monday', startTime: '09:00', endTime: '17:00' });
    setShowAvailabilityModal(true);
  };

  const addAvailSlot = () => {
    if (newAvailSlot.startTime >= newAvailSlot.endTime) { toast.error('End time must be after start time'); return; }
    if (availabilitySlots.find(s => s.day === newAvailSlot.day && s.startTime === newAvailSlot.startTime && s.endTime === newAvailSlot.endTime)) {
      toast.error('This slot already exists'); return;
    }
    setAvailabilitySlots(prev => [...prev, { ...newAvailSlot }]);
  };

  const saveAvailability = async () => {
    setSavingAvailability(true);
    try {
      const res = await doctorService.updateAvailability(availabilityDoctor._id, { availability: availabilitySlots });
      const updatedDoctor = res.data;
      setDoctors(prev => prev.map(d => d._id === updatedDoctor._id ? updatedDoctor : d));
      setExpandedDoctor(prev => prev?._id === updatedDoctor._id ? updatedDoctor : prev);
      toast.success('Availability saved');
      setShowAvailabilityModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving availability');
    } finally { setSavingAvailability(false); }
  };

  const groupByDay = (slots) => {
    const grouped = {};
    DAYS.forEach(d => { grouped[d] = []; });
    (slots || []).forEach(s => { if (grouped[s.day]) grouped[s.day].push(s); });
    return grouped;
  };

  const usedServiceIds = pendingServices.map(s => s.serviceId);
  const availableServicesForNew = services.filter(s => !usedServiceIds.includes(s._id));

  return (
    <div>
      <PageHeader title="Manage Doctors" subtitle="Create doctor profiles, assign services and set availability"
        action={<button onClick={openCreateModal} className="btn-primary flex items-center gap-2"><FiPlus size={16} />Add Doctor</button>} />

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {doctors.length === 0 ? <EmptyState message="No doctors yet" /> : doctors.map(doc => {
            const grouped = groupByDay(doc.availability);
            const activeDays = DAYS.filter(d => grouped[d].length > 0);
            return (
              <div key={doc._id} className="card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-teal-100 rounded-xl flex items-center justify-center font-bold text-teal-700 text-lg">
                      {doc.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{doc.designation || 'Dr.'} {doc.name}</p>
                      <p className="text-sm text-gray-500">{doc.phone} {doc.specialization && `• ${doc.specialization}`}</p>
                      {doc.slmcNumber && <p className="text-xs text-gray-400 font-mono">SLMC: {doc.slmcNumber}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`badge ${doc.isRegistered ? 'badge-green' : 'badge-yellow'}`}>
                          {doc.isRegistered ? 'Registered' : 'Pending Registration'}
                        </span>
                        <span className="badge badge-blue">{doc.services?.length || 0} services</span>
                        {activeDays.length > 0 ? (
                          <span className="badge bg-teal-100 text-teal-700 flex items-center gap-1">
                            <FiClock size={10} /> {activeDays.map(d => DAY_ABBR[d]).join(', ')}
                          </span>
                        ) : (
                          <span className="badge bg-gray-100 text-gray-500 flex items-center gap-1">
                            <FiClock size={10} /> No schedule set
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openAvailabilityModal(doc)} title="Set Availability"
                      className="text-gray-400 hover:text-teal-600 p-2 rounded-lg hover:bg-teal-50 transition">
                      <FiClock size={16} />
                    </button>
                    <button onClick={() => openEditModal(doc)}
                      className="text-gray-400 hover:text-primary-600 p-2 rounded-lg hover:bg-primary-50 transition"><FiEdit2 size={16} /></button>
                    <button onClick={() => setExpandedDoctor(expandedDoctor?._id === doc._id ? null : doc)}
                      className="text-gray-400 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition"><FiChevronDown size={16} /></button>
                  </div>
                </div>

                {expandedDoctor?._id === doc._id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-700">Services &amp; Pricing</p>
                        <button onClick={() => { setExpandedDoctor(doc); setServiceForm({ serviceId: '', price: '', doctorFee: '' }); setIsEditingService(false); setShowServiceModal(true); }}
                          className="btn-secondary text-xs flex items-center gap-1 py-1.5"><FiPlus size={13} />Add Service</button>
                      </div>
                      {doc.services?.length === 0
                        ? <p className="text-sm text-gray-400">No services assigned yet</p>
                        : <div className="grid gap-2">
                          {doc.services.map(svc => (
                            <div key={svc._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-sm font-medium text-gray-700">{svc.service?.name}</span>
                              <div className="flex items-center gap-3">
                                <div className="text-right mr-2">
                                  <p className="text-sm font-bold text-gray-900">Patient: LKR {svc.price}</p>
                                  <p className="text-xs text-primary-600 font-semibold">Doctor: LKR {svc.doctorFee !== undefined ? svc.doctorFee : svc.price}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => {
                                    setExpandedDoctor(doc);
                                    setServiceForm({ serviceId: svc.service._id, price: svc.price, doctorFee: svc.doctorFee !== undefined ? svc.doctorFee : svc.price });
                                    setIsEditingService(true); setShowServiceModal(true);
                                  }} className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-primary-50 transition"><FiEdit2 size={14} /></button>
                                  <button onClick={() => handleRemoveService(doc._id, svc.service._id)}
                                    className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><FiTrash2 size={14} /></button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      }
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                          <FiClock size={13} className="text-teal-500" /> Weekly Schedule
                        </p>
                        <button onClick={() => openAvailabilityModal(doc)} className="btn-secondary text-xs flex items-center gap-1 py-1.5">
                          <FiEdit2 size={13} /> Edit Schedule
                        </button>
                      </div>
                      {activeDays.length === 0 ? (
                        <p className="text-sm text-gray-400">No schedule set — click "Edit Schedule" to add availability</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {activeDays.map(day => (
                            <div key={day} className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                              <p className="text-xs font-bold text-teal-700 mb-1">{day}</p>
                              {grouped[day].map((slot, i) => (
                                <p key={i} className="text-xs text-teal-600 font-mono">{slot.startTime} – {slot.endTime}</p>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Doctor Modal ───────────────────────────────────── */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={selectedDoctor ? 'Edit Doctor' : 'Create New Doctor'}
        size={selectedDoctor ? 'md' : 'lg'}>

        {!selectedDoctor && (
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                {tab === 'Profile' && <FiUser size={13} />}
                {tab === 'Services' && <FiList size={13} />}
                {tab === 'Schedule' && <FiClock size={13} />}
                {tab}
                {tab === 'Services' && pendingServices.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{pendingServices.length}</span>
                )}
                {tab === 'Schedule' && pendingSlots.length > 0 && (
                  <span className="bg-teal-100 text-teal-700 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">{pendingSlots.length}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSave}>
          {/* Profile Tab */}
          {(activeTab === 'Profile' || selectedDoctor) && (
            <div className="space-y-4">
              {/* Designation + Name row */}
              <div className="flex gap-3">
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                  <select
                    value={form.designation}
                    onChange={e => setForm({ ...form, designation: e.target.value })}
                    className="input-field"
                  >
                    {['Dr.', 'Mr.', 'Ms.', 'Mrs.', 'Prof.', 'Rev.'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="input-field" required />
                </div>
              </div>
              {['phone', 'specialization', 'slmcNumber'].map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field === 'slmcNumber' ? 'SLMC Registration Number' : field}
                    {field !== 'specialization' && field !== 'slmcNumber' && ' *'}
                  </label>
                  <input value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })}
                    className="input-field" required={field !== 'specialization' && field !== 'slmcNumber'} />
                </div>
              ))}
              {!selectedDoctor && (
                <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  💡 Use the <strong>Services</strong> and <strong>Schedule</strong> tabs above to configure this doctor before saving.
                </p>
              )}
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'Services' && !selectedDoctor && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Add a Service</p>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Service</label>
                  <CreatableSelect
                    options={availableServicesForNew.map(s => ({ value: s._id, label: s.name }))}
                    value={newSvcForm.serviceId}
                    onChange={val => setNewSvcForm({ ...newSvcForm, serviceId: val })}
                    placeholder="Select or type to create a new service…"
                    createLabel="Create service"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Patient Price (LKR)</label>
                    <input type="number" min="0" value={newSvcForm.price}
                      onChange={e => setNewSvcForm({ ...newSvcForm, price: e.target.value })}
                      className="input-field" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Doctor Fee (LKR)</label>
                    <input type="number" min="0" value={newSvcForm.doctorFee}
                      onChange={e => setNewSvcForm({ ...newSvcForm, doctorFee: e.target.value })}
                      className="input-field" placeholder="0" />
                  </div>
                </div>
                <button type="button" onClick={addPendingService}
                  className="btn-secondary text-sm flex items-center gap-2 py-2">
                  <FiPlus size={14} /> Add to List
                </button>
              </div>

              {pendingServices.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No services added yet.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">To assign ({pendingServices.length})</p>
                  {pendingServices.map((svc, i) => (
                    <div key={i} className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
                      <span className="text-sm font-semibold text-primary-800">{svc.label}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-xs">
                          <p className="font-bold text-gray-700">Patient: LKR {svc.price}</p>
                          <p className="text-primary-600 font-semibold">Doctor: LKR {svc.doctorFee}</p>
                        </div>
                        <button type="button" onClick={() => setPendingServices(prev => prev.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><FiX size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'Schedule' && !selectedDoctor && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Add Time Slot</p>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[120px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Day</label>
                    <select value={newSlot.day} onChange={e => setNewSlot(s => ({ ...s, day: e.target.value }))} className="input-field">
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Start Time</label>
                    <input type="time" value={newSlot.startTime}
                      onChange={e => setNewSlot(s => ({ ...s, startTime: e.target.value }))} className="input-field" />
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">End Time</label>
                    <input type="time" value={newSlot.endTime}
                      onChange={e => setNewSlot(s => ({ ...s, endTime: e.target.value }))} className="input-field" />
                  </div>
                  <button type="button" onClick={addPendingSlot}
                    className="btn-primary flex items-center gap-2 py-2 px-4 whitespace-nowrap">
                    <FiPlus size={15} /> Add Slot
                  </button>
                </div>
              </div>

              {pendingSlots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No slots added yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {DAYS.filter(d => pendingSlots.some(s => s.day === d)).map(day => (
                    <div key={day} className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-teal-50 px-4 py-2"><p className="text-sm font-bold text-teal-700">{day}</p></div>
                      <div className="divide-y divide-gray-100">
                        {pendingSlots.map((slot, i) => ({ ...slot, origIdx: i })).filter(slot => slot.day === day).map(slot => (
                          <div key={slot.origIdx} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                              <FiClock size={13} className="text-teal-500" />
                              <span className="font-medium font-mono">{slot.startTime} – {slot.endTime}</span>
                            </div>
                            <button type="button" onClick={() => setPendingSlots(prev => prev.filter((_, i) => i !== slot.origIdx))}
                              className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><FiX size={15} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-5 mt-2 border-t border-gray-100">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            {!selectedDoctor && activeTab !== 'Profile' && (
              <button type="button" onClick={() => setActiveTab(TABS[TABS.indexOf(activeTab) - 1])} className="btn-secondary flex-1">← Back</button>
            )}
            {!selectedDoctor && activeTab !== 'Schedule' ? (
              <button type="button" onClick={() => {
                if (activeTab === 'Profile' && (!form.name || !form.phone)) { toast.error('Name and phone are required'); return; }
                setActiveTab(TABS[TABS.indexOf(activeTab) + 1]);
              }} className="btn-primary flex-1">Next →</button>
            ) : (
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving...' : (selectedDoctor ? 'Save Changes' : 'Create Doctor')}
              </button>
            )}
          </div>
        </form>
      </Modal>

      {/* ── Add/Edit Service Modal (existing doctors) ───────────────────── */}
      <Modal isOpen={showServiceModal} onClose={() => setShowServiceModal(false)} title={isEditingService ? `Edit Service — ${expandedDoctor?.designation || 'Dr.'} ${expandedDoctor?.name}` : `Add Service — ${expandedDoctor?.designation || 'Dr.'} ${expandedDoctor?.name}`}>
        <form onSubmit={handleSaveService} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
            {isEditingService ? (
              <select value={serviceForm.serviceId} disabled className="input-field bg-gray-50 text-gray-500 cursor-not-allowed">
                <option value={serviceForm.serviceId}>{services.find(s => s._id === serviceForm.serviceId)?.name || 'Service'}</option>
              </select>
            ) : (
              <CreatableSelect
                options={services.filter(s => !expandedDoctor?.services?.find(ds => ds.service?._id === s._id)).map(s => ({ value: s._id, label: s.name }))}
                value={serviceForm.serviceId}
                onChange={(val) => setServiceForm({ ...serviceForm, serviceId: val })}
                placeholder="Select or type to create a new service…"
                createLabel="Create service"
              />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Price (LKR) *</label>
              <input type="number" min="0" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Fee (LKR) *</label>
              <input type="number" min="0" value={serviceForm.doctorFee} onChange={e => setServiceForm({ ...serviceForm, doctorFee: e.target.value })} className="input-field" required />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowServiceModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : (isEditingService ? 'Update Service' : 'Add Service')}</button>
          </div>
        </form>
      </Modal>

      {/* ── Availability Modal (existing doctors) ───────────────────────── */}
      <Modal isOpen={showAvailabilityModal} onClose={() => setShowAvailabilityModal(false)}
        title={`Availability — ${availabilityDoctor?.designation || 'Dr.'} ${availabilityDoctor?.name}`} size="lg">
        <div className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Add Time Slot</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Day</label>
                <select value={newAvailSlot.day} onChange={e => setNewAvailSlot(s => ({ ...s, day: e.target.value }))} className="input-field">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">Start Time</label>
                <input type="time" value={newAvailSlot.startTime}
                  onChange={e => setNewAvailSlot(s => ({ ...s, startTime: e.target.value }))} className="input-field" />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="text-xs font-medium text-gray-500 mb-1 block">End Time</label>
                <input type="time" value={newAvailSlot.endTime}
                  onChange={e => setNewAvailSlot(s => ({ ...s, endTime: e.target.value }))} className="input-field" />
              </div>
              <button type="button" onClick={addAvailSlot} className="btn-primary flex items-center gap-2 py-2 px-4 whitespace-nowrap">
                <FiPlus size={15} /> Add Slot
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {availabilitySlots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No availability slots yet — add one above</p>
            ) : (
              DAYS.filter(d => availabilitySlots.some(s => s.day === d)).map(day => (
                <div key={day} className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="bg-teal-50 px-4 py-2"><p className="text-sm font-bold text-teal-700">{day}</p></div>
                  <div className="divide-y divide-gray-100">
                    {availabilitySlots.map((slot, i) => ({ ...slot, origIdx: i })).filter(slot => slot.day === day).map(slot => (
                      <div key={slot.origIdx} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <FiClock size={13} className="text-teal-500" />
                          <span className="font-medium font-mono">{slot.startTime} – {slot.endTime}</span>
                        </div>
                        <button type="button" onClick={() => setAvailabilitySlots(prev => prev.filter((_, i) => i !== slot.origIdx))}
                          className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"><FiX size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowAvailabilityModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={saveAvailability} disabled={savingAvailability} className="btn-primary flex-1">
              {savingAvailability ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
