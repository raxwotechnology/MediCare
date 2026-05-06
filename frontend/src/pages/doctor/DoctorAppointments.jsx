import { useState, useEffect } from 'react';
import { appointmentService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState } from '../../components/common';
import DatePickerWithHighlights from '../../components/common/DatePickerWithHighlights';
import toast from 'react-hot-toast';
import { FiCalendar, FiEdit2, FiPlus, FiTrash2, FiUserCheck, FiCheckCircle, FiClock } from 'react-icons/fi';

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [activeDates, setActiveDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [showComplete, setShowComplete] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [prescription, setPrescription] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        appointmentService.getAll({ date: dateFilter }),
        appointmentService.getActiveDates()
      ]);
      setAppointments(r.data);
      setActiveDates(d.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [dateFilter]);

  // Which patient is currently with the doctor
  const activePatient = appointments.find(a => a.status === 'with_doctor');

  const handleAccept = async (appt) => {
    setAccepting(appt._id);
    try {
      await appointmentService.acceptPatient(appt._id);
      toast.success(`Patient #${appt.queueNumber} — ${appt.patientName} accepted into room`);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setAccepting(null); }
  };

  const openComplete = (appt) => {
    setSelectedAppt(appt);
    setPrescription(appt.prescription || '');
    setMedicines(appt.prescribedMedicines?.length ? appt.prescribedMedicines : [{ name: '', dosage: '', quantity: 1 }]);
    setShowComplete(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await appointmentService.completePatient(selectedAppt._id, {
        prescription,
        prescribedMedicines: medicines.filter(m => m.name.trim()),
      });
      toast.success(`Patient #${selectedAppt.queueNumber} completed ✓`);
      setShowComplete(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving');
    } finally { setSaving(false); }
  };

  const addMed = () => setMedicines([...medicines, { name: '', dosage: '', quantity: 1 }]);
  const removeMed = (i) => setMedicines(medicines.filter((_, idx) => idx !== i));
  const updateMed = (i, f, v) => setMedicines(medicines.map((m, idx) => idx === i ? { ...m, [f]: v } : m));

  const statusBadge = {
    pending: 'badge-gray',
    paid: 'badge-yellow',
    with_doctor: 'bg-teal-100 text-teal-800',
    completed: 'badge-green',
  };

  const queue = [...appointments].sort((a, b) => {
    const statusOrder = { with_doctor: 1, paid: 2, pending: 3, completed: 4 };
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return a.queueNumber - b.queueNumber;
  });

  return (
    <div>
      <PageHeader title="My Appointments" subtitle="Manage your patient queue" />

      {/* Active patient banner */}
      {activePatient && (
        <div className="mb-4 bg-teal-50 border-2 border-teal-300 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
              #{activePatient.queueNumber}
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Currently in room</p>
              <p className="font-bold text-teal-900 text-lg">{activePatient.patientName}</p>
              <p className="text-sm text-teal-700">{activePatient.patientPhone} &bull; {activePatient.service?.name}</p>
            </div>
          </div>
          <button onClick={() => openComplete(activePatient)} className="btn-success flex items-center gap-2">
            <FiCheckCircle size={16} />Complete & Prescribe
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="w-full sm:w-64">
          <DatePickerWithHighlights
            value={dateFilter}
            onChange={(iso) => setDateFilter(iso || new Date().toISOString().split('T')[0])}
            highlightedDates={activeDates}
            accent="primary"
            legend="Has appointments"
          />
        </div>

        {activeDates.length > 0 && (
          <div className="flex-1 flex flex-wrap items-center gap-2 border-l border-gray-100 pl-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Active Dates</span>
            {activeDates.sort().reverse().slice(0, 5).map(d => (
              <button 
                key={d} 
                onClick={() => setDateFilter(d)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border
                  ${dateFilter === d 
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-200 scale-105' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:bg-primary-50'}`}
              >
                {new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </button>
            ))}
          </div>
        )}
        
        <span className="text-sm text-gray-500 self-center">{appointments.length} appointments</span>
      </div>

      {loading ? <Spinner /> : queue.length === 0
        ? <EmptyState message="No appointments for this date" icon={<FiCalendar size={40} />} />
        : (
          <div className="space-y-3">
            {queue.map(appt => (
              <div key={appt._id} className={`card transition-all ${appt.status === 'with_doctor' ? 'ring-2 ring-teal-400 bg-teal-50' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0
                      ${appt.status === 'with_doctor' ? 'bg-teal-500 text-white'
                      : appt.status === 'paid' ? 'bg-blue-100 text-blue-700'
                      : appt.status === 'completed' ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'}`}>
                      #{appt.queueNumber}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{appt.patientName}</p>
                      <p className="text-sm text-gray-500">{appt.patientPhone}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{appt.service?.name} — <span className="font-medium text-primary-600">LKR {appt.price}</span></p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`badge ${statusBadge[appt.status] || 'badge-gray'}`}>
                      {appt.status === 'with_doctor' ? '🩺 In Room' : appt.status === 'paid' ? '⏳ Waiting' : appt.status === 'completed' ? '✓ Completed' : appt.status}
                    </span>

                    {appt.status === 'paid' && !activePatient && (
                      <button onClick={() => handleAccept(appt)} disabled={accepting === appt._id}
                        className="btn-primary text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiUserCheck size={13} />
                        {accepting === appt._id ? 'Accepting...' : 'Accept Patient'}
                      </button>
                    )}
                    {appt.status === 'paid' && activePatient && activePatient._id !== appt._id && (
                      <span className="text-xs text-gray-400 flex items-center gap-1"><FiClock size={12} />Waiting</span>
                    )}
                    {appt.status === 'with_doctor' && (
                      <button onClick={() => openComplete(appt)} className="btn-success text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiCheckCircle size={13} />Complete
                      </button>
                    )}
                    {appt.status === 'completed' && (
                      <button onClick={() => openComplete(appt)} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiEdit2 size={12} />Edit Rx
                      </button>
                    )}
                  </div>
                </div>

                {appt.prescription && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1">PRESCRIPTION</p>
                    <p className="text-sm text-gray-700">{appt.prescription}</p>
                    {appt.prescribedMedicines?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {appt.prescribedMedicines.map((m, i) => (
                          <span key={i} className="badge badge-blue">{m.name} • {m.dosage} × {m.quantity}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {appt.status === 'with_doctor' && appt.doctorQueue?.acceptedAt && (
                  <p className="text-xs text-teal-600 mt-2 pt-2 border-t border-teal-200">
                    Accepted at {new Date(appt.doctorQueue.acceptedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )
      }

      {/* Complete + Prescribe modal */}
      <Modal isOpen={showComplete} onClose={() => setShowComplete(false)}
        title={`Complete Appointment — ${selectedAppt?.patientName}`} size="lg">
        <form onSubmit={handleComplete} className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-3 flex gap-4 text-sm">
            <div><span className="text-gray-400">Queue</span><p className="font-bold text-primary-600">#{selectedAppt?.queueNumber}</p></div>
            <div><span className="text-gray-400">Service</span><p className="font-medium">{selectedAppt?.service?.name}</p></div>
            <div><span className="text-gray-400">Amount</span><p className="font-medium">LKR {selectedAppt?.price}</p></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prescription / Notes</label>
            <textarea value={prescription} onChange={e => setPrescription(e.target.value)}
              className="input-field" rows={4} placeholder="Diagnosis, treatment notes, follow-up instructions..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Prescribed Medicines</label>
              <button type="button" onClick={addMed} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                <FiPlus size={13} />Add
              </button>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
                <span className="col-span-5">Medicine</span><span className="col-span-4">Dosage</span><span className="col-span-2">Qty</span>
              </div>
              {medicines.map((med, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input placeholder="Name" value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} className="input-field col-span-5 text-sm" />
                  <input placeholder="e.g. 500mg 3×" value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} className="input-field col-span-4 text-sm" />
                  <input type="number" min="1" value={med.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)} className="input-field col-span-2 text-sm" />
                  <button type="button" onClick={() => removeMed(i)} disabled={medicines.length === 1}
                    className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 p-1 text-center">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowComplete(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-success flex-1">
              {saving ? 'Saving...' : selectedAppt?.status === 'with_doctor' ? '✓ Complete & Save Prescription' : 'Update Prescription'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

