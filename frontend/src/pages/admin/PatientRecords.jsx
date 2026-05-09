import { useState, useEffect, useCallback } from 'react';
import { appointmentService } from '../../services';
import { PageHeader, Spinner, EmptyState } from '../../components/common';
import {
  FiUsers, FiCalendar, FiPackage, FiSearch, FiChevronDown,
  FiChevronUp, FiPhone, FiX, FiDollarSign, FiActivity,
  FiFileText, FiClock
} from 'react-icons/fi';

/* ─── helpers ─────────────────────────────────────────────── */
const statusColor = (s) => ({
  completed: 'badge-green',
  paid: 'badge-blue',
  with_doctor: 'badge badge-yellow',
  pending: 'badge badge-gray',
  cancelled: 'badge badge-red',
}[s] || 'badge badge-gray');

function groupByPatient(appointments) {
  const map = {};
  appointments.forEach((a) => {
    const key = a.patientPhone;
    if (!map[key]) {
      map[key] = {
        name: a.patientName,
        phone: a.patientPhone,
        patientUserId: a.patientUser || null,
        appointments: [],
        totalSpent: 0,
        medicines: [],
      };
    }
    map[key].appointments.push(a);

    // total spent — reception payment + pharmacy bills
    const receptionPaid = a.receptionPayment?.totalPaid || a.receptionPayment?.amount || a.price || 0;
    const pharmPaid = (a.pharmacyBills || []).reduce((s, b) => s + (b.totalAmount || 0), 0);
    const extraPaid = (a.extraCharges || []).reduce((s, c) => s + (c.price || 0), 0);
    map[key].totalSpent += receptionPaid + pharmPaid + extraPaid;

    // collect medicines
    (a.prescribedMedicines || []).forEach((m) => {
      const existing = map[key].medicines.find((x) => x.name === m.name);
      if (existing) existing.count += 1;
      else map[key].medicines.push({ name: m.name, dosage: m.dosage, count: 1 });
    });
    (a.pharmacyBills || []).forEach((b) => {
      (b.medicines || []).forEach((m) => {
        const existing = map[key].medicines.find((x) => x.name === m.name);
        if (existing) existing.count += 1;
        else map[key].medicines.push({ name: m.name, count: 1 });
      });
    });
  });
  return Object.values(map).sort((a, b) => b.appointments.length - a.appointments.length);
}

/* ─── Patient Row (expandable) ───────────────────────────── */
function PatientRow({ patient }) {
  const [open, setOpen] = useState(false);

  const completed = patient.appointments.filter((a) => a.status === 'completed').length;
  const cancelled = patient.appointments.filter((a) => a.status === 'cancelled').length;
  const lastVisit = patient.appointments.length
    ? patient.appointments.sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate))[0].appointmentDate
    : null;

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-primary-50/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <td>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm uppercase flex-shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{patient.name}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><FiPhone size={10} />{patient.phone}</p>
            </div>
          </div>
        </td>
        <td className="text-center">
          <span className="font-bold text-primary-600 text-lg">{patient.appointments.length}</span>
        </td>
        <td className="text-center">
          <span className="badge badge-green">{completed}</span>
        </td>
        <td className="text-center">
          {cancelled > 0 ? <span className="badge badge-red">{cancelled}</span> : <span className="text-gray-300">—</span>}
        </td>
        <td>
          <div className="flex flex-wrap gap-1 max-w-xs">
            {patient.medicines.length === 0 ? (
              <span className="text-gray-300 text-xs">None</span>
            ) : (
              patient.medicines.slice(0, 3).map((m, i) => (
                <span key={i} className="badge badge-blue text-xs">{m.name}</span>
              ))
            )}
            {patient.medicines.length > 3 && (
              <span className="badge badge-gray text-xs">+{patient.medicines.length - 3} more</span>
            )}
          </div>
        </td>
        <td className="font-semibold text-emerald-700">LKR {patient.totalSpent.toLocaleString()}</td>
        <td className="text-xs text-gray-400">{lastVisit || '—'}</td>
        <td>
          <button className="text-gray-400 hover:text-primary-600 transition-colors p-1">
            {open ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
          </button>
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-slate-50 border-t border-b border-primary-100 px-6 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Appointments list */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                    <FiCalendar size={12} /> Appointment History
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {patient.appointments
                      .sort((a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate))
                      .map((a) => (
                        <div key={a._id} className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{a.serviceName || a.service?.name}</p>
                            <p className="text-xs text-gray-400">
                              Dr. {a.doctorName || a.doctor?.name} · {a.appointmentDate}
                            </p>
                            {a.prescription && (
                              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <FiFileText size={10} className="text-primary-400" />
                                {a.prescription.length > 80 ? a.prescription.slice(0, 80) + '…' : a.prescription}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`badge text-xs ${statusColor(a.status)}`}>{a.status}</span>
                            <span className="text-xs font-semibold text-emerald-700">LKR {a.price}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Medicines */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                    <FiPackage size={12} /> All Medicines Received
                  </h4>
                  {patient.medicines.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No medicines recorded</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {patient.medicines.map((m, i) => (
                        <div key={i} className="bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                          <p className="text-sm font-medium text-gray-800">{m.name}</p>
                          {m.dosage && <p className="text-xs text-gray-400">{m.dosage}</p>}
                          <p className="text-xs text-blue-500 font-semibold">{m.count}× prescribed</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pharmacy bills summary */}
                  {patient.appointments.some((a) => a.pharmacyBills?.length > 0) && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                        <FiDollarSign size={12} /> Pharmacy Bills
                      </h4>
                      <div className="space-y-1">
                        {patient.appointments.flatMap((a) =>
                          (a.pharmacyBills || []).map((b, i) => (
                            <div key={`${a._id}-${i}`} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-1.5 text-sm">
                              <span className="text-gray-600">{a.appointmentDate} · Bill #{b.billNumber}</span>
                              <span className="font-semibold text-emerald-700">LKR {b.totalAmount}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function PatientRecords() {
  const [allAppointments, setAllAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('appointments'); // appointments | spent | name

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch with a large limit to get all appointments
      const r = await appointmentService.getAll({ limit: 2000 });
      setAllAppointments(Array.isArray(r.data) ? r.data : r.data.appointments || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const allPatients = groupByPatient(allAppointments);

  const filtered = allPatients
    .filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search)
    )
    .sort((a, b) => {
      if (sortBy === 'spent') return b.totalSpent - a.totalSpent;
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.appointments.length - a.appointments.length;
    });

  const totalPatients = allPatients.length;
  const totalVisits = allAppointments.filter((a) => a.status !== 'cancelled').length;
  const totalRevenue = allPatients.reduce((s, p) => s + p.totalSpent, 0);
  const repeatPatients = allPatients.filter((p) => p.appointments.length > 1).length;

  return (
    <div>
      <PageHeader
        title="Patient Records"
        subtitle="Complete overview of all patients — appointments, medicines, and spending"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: FiUsers, label: 'Total Patients', value: totalPatients, color: 'text-primary-600', bg: 'bg-primary-50' },
          { icon: FiCalendar, label: 'Total Visits', value: totalVisits, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: FiActivity, label: 'Repeat Patients', value: repeatPatients, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: FiDollarSign, label: 'Total Revenue', value: `LKR ${totalRevenue.toLocaleString()}`, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="card mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FiX size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 whitespace-nowrap">Sort by:</span>
          {[
            { key: 'appointments', label: 'Most Visits' },
            { key: 'spent', label: 'Top Spenders' },
            { key: 'name', label: 'Name A–Z' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                sortBy === opt.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        Showing {filtered.length} of {totalPatients} patients
      </p>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState message="No patients found" icon={<FiUsers size={40} />} />
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th className="text-center">Total Visits</th>
                <th className="text-center">Completed</th>
                <th className="text-center">Cancelled</th>
                <th>Medicines</th>
                <th>Total Spent</th>
                <th>Last Visit</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((patient) => (
                <PatientRow key={patient.phone} patient={patient} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
