import { useState, useEffect } from 'react';
import { pharmacyService } from '../../services';
import { StatCard, Spinner } from '../../components/common';
import { Link } from 'react-router-dom';
import { FiPackage, FiClock, FiCheckCircle, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

export default function PharmacistDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    pharmacyService.getAppointments({ date: today }).then(r => setAppointments(r.data)).finally(() => setLoading(false));
  }, []);

  const withPrescription = appointments.filter(a => a.prescribedMedicines?.length > 0);
  const billed = appointments.filter(a => a.pharmacyBill?.totalAmount);
  const totalRevenue = appointments.reduce((s, a) => s + (a.pharmacyBill?.totalAmount || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-gray-900">Pharmacy Dashboard 💊</h1>
        <p className="text-gray-500 text-sm mt-1">Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard icon={FiPackage} label="Total Patients" value={appointments.length} color="blue" />
        <StatCard icon={FiClock} label="With Prescription" value={withPrescription.length} color="orange" />
        <StatCard icon={FiCheckCircle} label="Billed Today" value={billed.length} color="green" />
      </div>

      {totalRevenue > 0 && (
        <div className="card mb-6 bg-emerald-50 border-emerald-200 border">
          <p className="text-sm text-emerald-600 font-medium">Today's Pharmacy Revenue</p>
          <p className="text-3xl font-display font-bold text-emerald-700 mt-1">LKR {totalRevenue.toLocaleString()}</p>
        </div>
      )}

      <Link to="/pharmacist/queue" className="card flex items-center justify-between mb-6 hover:bg-gray-50 transition-colors group">
        <div>
          <p className="font-semibold text-gray-900">View Pharmacy Queue</p>
          <p className="text-sm text-gray-500">Process prescriptions and create bills</p>
        </div>
        <FiArrowRight className="text-gray-400 group-hover:text-primary-600 transition-colors" size={20} />
      </Link>

      {loading ? <Spinner /> : (
        <div className="card">
          <h3 className="font-display font-bold text-gray-900 mb-4">Recent Completed Visits</h3>
          {withPrescription.length === 0
            ? <p className="text-gray-400 text-sm text-center py-4">No prescriptions yet today</p>
            : <div className="space-y-2">
                {withPrescription.slice(0, 5).map(a => (
                  <div key={a._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-sm">{a.patientName}</p>
                      <p className="text-xs text-gray-500">{a.prescribedMedicines?.length} medicine(s) prescribed</p>
                    </div>
                    {a.pharmacyBill?.totalAmount
                      ? <span className="badge badge-green">Billed LKR {a.pharmacyBill.totalAmount}</span>
                      : <span className="badge badge-yellow">Pending Bill</span>
                    }
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}
