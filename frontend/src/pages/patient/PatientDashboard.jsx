// PatientDashboard.jsx
import { useState, useEffect } from 'react';
import { appointmentService } from '../../services';
import { StatCard, Spinner } from '../../components/common';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiCheckCircle, FiPlus } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appointmentService.getAll().then(r => setAppointments(r.data)).finally(() => setLoading(false));
  }, []);

  const pending = appointments.filter(a => a.status === 'pending').length;
  const completed = appointments.filter(a => a.status === 'completed').length;
  const upcoming = appointments.filter(a => a.status === 'paid').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Hello, {user?.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your health appointments</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={FiClock} label="Pending" value={pending} color="orange" />
        <StatCard icon={FiCalendar} label="Upcoming" value={upcoming} color="blue" />
        <StatCard icon={FiCheckCircle} label="Completed" value={completed} color="green" />
      </div>

      <div className="grid gap-4 mb-6">
        <Link to="/book" className="card flex items-center gap-4 border-2 border-dashed border-primary-200 hover:border-primary-400 hover:bg-primary-50 transition-all group">
          <div className="w-12 h-12 bg-primary-100 group-hover:bg-primary-200 rounded-xl flex items-center justify-center transition-colors">
            <FiPlus className="text-primary-600" size={22} />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Book New Appointment</p>
            <p className="text-sm text-gray-500">Choose a doctor and service</p>
          </div>
        </Link>
      </div>

      {loading ? <Spinner /> : (
        <div className="card">
          <h3 className="font-display font-bold text-gray-900 mb-4">Recent Appointments</h3>
          {appointments.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No appointments yet. <Link to="/book" className="text-primary-600 hover:underline">Book one now!</Link></p>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 5).map(a => (
                <div key={a._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">Dr. {a.doctor?.name}</p>
                    <p className="text-xs text-gray-500">{a.service?.name} • {a.appointmentDate}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge ${a.status === 'completed' ? 'badge-green' : a.status === 'paid' ? 'badge-blue' : 'badge-yellow'}`}>{a.status}</span>
                    <p className="text-xs text-gray-400 mt-1">Queue #{a.queueNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
