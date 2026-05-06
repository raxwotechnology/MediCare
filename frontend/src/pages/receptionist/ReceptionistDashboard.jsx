// ReceptionistDashboard.jsx
import { useState, useEffect } from 'react';
import { appointmentService } from '../../services';
import { StatCard, Spinner } from '../../components/common';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    appointmentService.getAll({ date: today }).then(r => setAppointments(r.data)).finally(() => setLoading(false));
  }, []);

  const pending = appointments.filter(a => a.status === 'pending');
  const paid = appointments.filter(a => a.status === 'paid');
  const completed = appointments.filter(a => a.status === 'completed');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Reception Desk 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={FiClock} label="Awaiting Payment" value={pending.length} color="orange" />
        <StatCard icon={FiCalendar} label="Paid / With Doctor" value={paid.length} color="blue" />
        <StatCard icon={FiCheckCircle} label="Completed" value={completed.length} color="green" />
      </div>

      <Link to="/receptionist/appointments" className="card flex items-center justify-between mb-6 hover:bg-gray-50 transition-colors group">
        <div>
          <p className="font-semibold text-gray-900">Manage Today's Queue</p>
          <p className="text-sm text-gray-500">Process payments and check in patients</p>
        </div>
        <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" size={20} />
      </Link>

      {loading ? <Spinner /> : (
        <div className="card">
          <h3 className="font-display font-bold text-gray-900 mb-4">Awaiting Payment ({pending.length})</h3>
          {pending.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">All caught up!</p>
            : <div className="space-y-2">
                {pending.map(a => (
                  <div key={a._id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-amber-700">#{a.queueNumber}</span>
                      <div>
                        <p className="font-medium text-sm">{a.patientName}</p>
                        <p className="text-xs text-gray-500">Dr. {a.doctor?.name} • {a.service?.name}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary-600">LKR {a.price}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}
