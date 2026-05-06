import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { appointmentService, userService, doctorService, reportService } from '../../services';
import { StatCard, Spinner } from '../../components/common';
import { FiUsers, FiCalendar, FiDollarSign, FiUser, FiActivity, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentAppts, setRecentAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    Promise.all([
      reportService.getSummary({ startDate: today, endDate: today }),
      appointmentService.getAll({ date: today }),
      userService.getAll(),
    ]).then(([sumRes, apptRes, usersRes]) => {
      setStats(sumRes.data);
      setRecentAppts(apptRes.data.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Welcome back, {user?.name} 👋</h1>
        <p className="text-gray-500 text-sm mt-1">Here's today's overview — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FiCalendar} label="Today's Appointments" value={recentAppts.length} color="blue" />
        <StatCard icon={FiDollarSign} label="Net Profit (Today)" value={`LKR ${stats?.netProfit || 0}`} color="purple" />
        <StatCard icon={FiDollarSign} label="Appt. Revenue" value={`LKR ${stats?.appointmentRevenue || 0}`} color="green" />
        <StatCard icon={FiActivity} label="Pharmacy Rev." value={`LKR ${stats?.pharmacyRevenue || 0}`} color="teal" />
        
        <StatCard icon={FiDollarSign} label="Extra Income" value={`LKR ${stats?.totalExtraIncome || 0}`} color="blue" />
        <StatCard icon={FiDollarSign} label="Expenses" value={`LKR ${stats?.totalExpenses || 0}`} color="red" />
        <StatCard icon={FiDollarSign} label="Pending Doctor Pay" value={`LKR ${stats?.pendingDoctorPayments || 0}`} color="orange" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { to: '/admin/users', label: 'Manage Users', icon: FiUsers, color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
          { to: '/admin/doctors', label: 'Doctors', icon: FiUser, color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
          { to: '/admin/payments', label: 'Doctor Payments', icon: FiDollarSign, color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
          { to: '/admin/reports', label: 'Reports', icon: FiActivity, color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
        ].map(item => (
          <Link key={item.to} to={item.to} className={`flex items-center gap-3 p-4 rounded-xl font-medium text-sm transition-colors ${item.color}`}>
            <item.icon size={20} />
            {item.label}
            <FiArrowRight size={14} className="ml-auto" />
          </Link>
        ))}
      </div>

      {/* Today's appointments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-gray-900">Today's Appointments</h3>
          <Link to="/admin/users" className="text-sm text-primary-600 font-medium hover:underline flex items-center gap-1">
            View all <FiArrowRight size={14} />
          </Link>
        </div>
        {recentAppts.length === 0
          ? <p className="text-gray-400 text-sm text-center py-6">No appointments today</p>
          : <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>Patient</th><th>Doctor</th><th>Service</th><th>Amount</th><th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentAppts.map(a => (
                    <tr key={a._id}>
                      <td className="font-bold text-primary-600">#{a.queueNumber}</td>
                      <td>
                        <p className="font-medium">{a.patientName}</p>
                        <p className="text-xs text-gray-400">{a.patientPhone}</p>
                      </td>
                      <td>Dr. {a.doctor?.name}</td>
                      <td>{a.service?.name}</td>
                      <td className="font-medium">LKR {a.price}</td>
                      <td><span className={`badge ${a.status === 'paid' ? 'badge-blue' : a.status === 'completed' ? 'badge-green' : 'badge-yellow'}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </div>
  );
}
