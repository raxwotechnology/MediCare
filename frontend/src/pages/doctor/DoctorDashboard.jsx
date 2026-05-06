// DoctorDashboard.jsx
import { useState, useEffect } from 'react';
import { doctorService, appointmentService } from '../../services';
import { StatCard, Spinner } from '../../components/common';
import { FiCalendar, FiDollarSign, FiActivity, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      doctorService.getMyStats({ startDate: today, endDate: today }),
      doctorService.getMyProfile(),
      appointmentService.getAll({ date: today }),
    ]).then(([statsRes, profileRes, apptRes]) => {
      setStats(statsRes.data); setProfile(profileRes.data); setTodayAppts(apptRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Welcome, Dr. {user?.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FiCalendar} label="Today's Patients" value={todayAppts.length} color="blue" />
        <StatCard icon={FiActivity} label="Services Today" value={stats?.totalServices || 0} color="teal" />
        <StatCard icon={FiDollarSign} label="Today's Amount" value={`LKR ${stats?.totalAmount || 0}`} color="green" />
        <StatCard icon={FiDollarSign} label="Pending Payment" value={`LKR ${stats?.pendingAmount || 0}`} color="orange" />
      </div>

      {profile && (
        <div className="card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center font-bold text-teal-700 text-2xl">
              {profile.name?.charAt(0)}
            </div>
            <div>
              <h3 className="font-display font-bold text-gray-900">Dr. {profile.name}</h3>
              <p className="text-gray-500 text-sm">{profile.specialization || 'General Practitioner'} • {profile.phone}</p>
              <div className="flex gap-2 mt-1">
                <span className="badge badge-blue">{profile.services?.length} services</span>
                <span className="badge badge-green">Registered</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="font-display font-bold text-gray-900 mb-4">Today's Appointments</h3>
        {todayAppts.length === 0
          ? <p className="text-gray-400 text-sm text-center py-6">No appointments today</p>
          : <div className="space-y-3">
              {todayAppts.map(a => (
                <div key={a._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-700 text-sm">#{a.queueNumber}</div>
                    <div>
                      <p className="font-medium text-sm">{a.patientName}</p>
                      <p className="text-xs text-gray-400">{a.patientPhone} • {a.service?.name || a.serviceName || 'Service'}</p>
                    </div>
                  </div>
                  <span className={`badge ${a.status === 'paid' ? 'badge-blue' : a.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{a.status}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
