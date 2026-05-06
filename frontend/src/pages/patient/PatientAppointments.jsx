import { useState, useEffect } from 'react';
import { appointmentService } from '../../services';
import { PageHeader, Spinner, EmptyState } from '../../components/common';
import { FiCalendar } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function PatientAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    appointmentService.getAll().then(r => setAppointments(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);

  return (
    <div>
      <PageHeader title="My Appointments" subtitle="View all your current and past appointments"
        action={<Link to="/book" className="btn-primary">Book New</Link>} />

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all', 'pending', 'paid', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors capitalize ${filter === s ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0
        ? <EmptyState message="No appointments found" icon={<FiCalendar size={40} />} />
        : (
          <div className="space-y-4">
            {filtered.map(a => (
              <div key={a._id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-primary-600">#{a.queueNumber}</span>
                      <span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'paid' ? 'badge-blue' : 'badge-yellow'}`}>{a.status}</span>
                    </div>
                    <p className="font-semibold text-gray-900">Dr. {a.doctor?.name}</p>
                    <p className="text-sm text-gray-500">{a.service?.name}</p>
                    <p className="text-sm text-gray-400 mt-1">{a.appointmentDate}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-primary-600">LKR {a.price}</p>
                    {a.receptionPayment?.paidAt && <p className="text-xs text-gray-400 mt-1">Paid ✓</p>}
                  </div>
                </div>

                {a.prescription && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1">DOCTOR'S NOTES</p>
                    <p className="text-sm text-gray-700">{a.prescription}</p>
                    {a.prescribedMedicines?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {a.prescribedMedicines.map((m, i) => (
                          <span key={i} className="badge badge-blue text-xs">{m.name} × {m.quantity}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {a.pharmacyBill?.totalAmount && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 mb-1">PHARMACY BILL</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{a.pharmacyBill.medicines?.length} item(s)</span>
                      <span className="font-bold text-emerald-600">LKR {a.pharmacyBill.totalAmount}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
