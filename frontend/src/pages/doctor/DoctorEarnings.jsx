import { useState, useEffect } from 'react';
import { doctorService, paymentService } from '../../services';
import { PageHeader, StatCard, Spinner } from '../../components/common';
import { FiDollarSign, FiTrendingUp, FiClock, FiCheckCircle } from 'react-icons/fi';

export default function DoctorEarnings() {
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dates, setDates] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const [statsRes, payRes] = await Promise.all([
        doctorService.getMyStats(dates),
        paymentService.getAll(),
      ]);
      setStats(statsRes.data);
      setPayments(payRes.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <div>
      <PageHeader title="My Earnings" subtitle="View your service revenue and payment history" />

      {/* Date filter */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={dates.startDate} onChange={e => setDates({ ...dates, startDate: e.target.value })} className="input-field" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={dates.endDate} onChange={e => setDates({ ...dates, endDate: e.target.value })} className="input-field" />
          </div>
          <button onClick={fetch} className="btn-primary px-6">Filter</button>
        </div>
      </div>

      {loading ? <Spinner /> : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={FiTrendingUp} label="Services Rendered" value={stats.totalServices} color="blue" />
            <StatCard icon={FiDollarSign} label="Total Earned" value={`LKR ${stats.totalAmount?.toLocaleString()}`} color="green" sub="From completed appointments" />
            <StatCard icon={FiCheckCircle} label="Amount Received" value={`LKR ${stats.paidAmount?.toLocaleString()}`} color="teal" sub="Paid out by clinic" />
            <StatCard icon={FiClock} label="Pending Amount" value={`LKR ${((stats.totalAmount || 0) - (stats.paidAmount || 0)).toLocaleString()}`} color="orange" sub="Total Earned − Received" />
          </div>

          {/* Payment records */}
          <div className="card mb-6">
            <h3 className="font-display font-semibold text-gray-900 mb-4">Payment Records</h3>
            {payments.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-6">No payment records found</p>
            ) : (
              <div className="space-y-3">
                {payments.map(p => (
                  <div key={p._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800">LKR {p.amount?.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.periodStart?.split('T')[0]} → {p.periodEnd?.split('T')[0]}
                        {p.notes && ` • ${p.notes}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`badge ${p.status === 'paid' ? 'badge-green' : 'badge-yellow'}`}>{p.status}</span>
                      {p.status === 'paid' && <p className="text-xs text-gray-400 mt-1">Paid {p.paidAt?.split('T')[0]}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service breakdown */}
          {stats.appointments?.length > 0 && (
            <div className="card">
              <h3 className="font-display font-semibold text-gray-900 mb-4">Service Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Date</th><th>Patient</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {stats.appointments.map(a => (
                      <tr key={a._id}>
                        <td className="text-gray-500">{a.appointmentDate}</td>
                        <td className="font-medium">{a.patientName}</td>
                        <td>{a.service?.name}</td>
                        <td className="font-semibold text-primary-600">LKR {a.price}</td>
                        <td><span className={`badge ${a.status === 'completed' ? 'badge-green' : 'badge-blue'}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
