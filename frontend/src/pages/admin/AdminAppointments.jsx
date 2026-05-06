import { useState, useEffect } from 'react';
import { appointmentService, doctorService } from '../../services';
import { PageHeader, Spinner, EmptyState, Modal } from '../../components/common';
import DatePickerWithHighlights from '../../components/common/DatePickerWithHighlights';
import toast from 'react-hot-toast';
import { FiCalendar, FiCheck, FiSearch, FiUser, FiTrash2 } from 'react-icons/fi';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(null);

  // Dates that have appointments — highlights for the picker.
  // Reloads when doctor filter changes.
  const [activeDates, setActiveDates] = useState([]);
  useEffect(() => {
    appointmentService.getActiveDates({
      ...(selectedDoctor ? { doctorId: selectedDoctor } : {}),
      excludeCancelled: 1,
    })
      .then(r => setActiveDates(r.data || []))
      .catch(() => setActiveDates([]));
  }, [selectedDoctor, appointments]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [apptsRes, docsRes] = await Promise.all([
        appointmentService.getAll({ date: dateFilter, doctorId: selectedDoctor }),
        doctorService.getAll()
      ]);
      setAppointments(apptsRes.data);
      if (doctors.length === 0) setDoctors(docsRes.data);
    } catch (err) {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, selectedDoctor]);

  const handleCancelAppointment = async (appt) => {
    if (!confirm(`Are you sure you want to cancel the appointment for ${appt.patientName}?`)) return;
    setProcessing(appt._id);
    try {
      await appointmentService.cancel(appt._id);
      toast.success('Appointment cancelled successfully');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error cancelling appointment');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteAppointment = async (appt) => {
    if (!confirm(`WARNING: Completely delete the appointment for ${appt.patientName}?\nThis removes it from audit history. Cancel is preferred.`)) return;
    setProcessing(appt._id);
    try {
      await appointmentService.delete(appt._id);
      toast.success('Appointment deleted completely');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting appointment');
    } finally {
      setProcessing(null);
    }
  };

  const filtered = appointments.filter(a =>
    a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    a.patientPhone?.includes(search)
  );

  const statusOrder = { pending: 0, paid: 1, with_doctor: 2, completed: 3, cancelled: 4 };
  const sorted = [...filtered].sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.queueNumber - b.queueNumber);

  return (
    <div>
      <PageHeader title="Manage Appointments" subtitle="Admin access to oversee and manage all clinic appointments" />

      <div className="card mb-6 flex flex-col md:flex-row gap-4 bg-gray-50/50">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <select value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} className="input-field pl-9">
              <option value="">All Doctors</option>
              {doctors.map(d => (
                <option key={d._id} value={d._id}>Dr. {d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <DatePickerWithHighlights
            value={dateFilter}
            onChange={(iso) => setDateFilter(iso || new Date().toISOString().split('T')[0])}
            highlightedDates={activeDates}
            accent="primary"
            legend={selectedDoctor ? 'Booked for this doctor' : 'Has appointments'}
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient</label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input placeholder="Name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
          </div>
        </div>
      </div>

      {loading ? <Spinner /> : sorted.length === 0 ? (
        <EmptyState message="No appointments match the selected filters." icon={<FiCalendar size={40} />} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="table w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100 text-sm">
              <tr>
                <th className="py-3 px-4">Queue #</th>
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Doctor & Service</th>
                <th className="py-3 px-4 text-right">Fee (LKR)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {sorted.map(appt => (
                <tr key={appt._id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-600">#{appt.queueNumber}</td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900">{appt.patientName}</p>
                    <p className="text-xs text-gray-500">{appt.patientPhone}</p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">Dr. {appt.doctor?.name || appt.doctorName || 'Deleted'}</p>
                    <p className="text-xs text-gray-500">{appt.service?.name || appt.serviceName || 'Service'}</p>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-primary-600">
                    {appt.price}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`badge ${
                      appt.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      appt.status === 'paid' ? 'bg-blue-100 text-blue-700' :
                      appt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {appt.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                       {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                         <button
                           onClick={() => handleCancelAppointment(appt)}
                           disabled={processing === appt._id}
                           className="text-xs font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center justify-center px-2 py-1.5 rounded-lg transition-colors"
                           title="Gracefully Cancel"
                         >
                           Cancel
                         </button>
                       )}
                       <button
                         onClick={() => handleDeleteAppointment(appt)}
                         disabled={processing === appt._id}
                         className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                         title="Hard Delete"
                       >
                         <FiTrash2 size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
