import { useState, useEffect, useCallback } from 'react';
import { reportService } from '../../services';
import { PageHeader, Spinner, StatCard } from '../../components/common';
import toast from 'react-hot-toast';
import {
  FiBarChart2, FiDollarSign, FiTrendingUp, FiUsers,
  FiCalendar, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';

/* ── Small pill badge ─────────────────────────────────────────────── */
function Pill({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  );
}

/* ── Progress bar ─────────────────────────────────────────────────── */
function Bar({ value, max, color = 'bg-primary-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ServiceReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedService, setExpandedService] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await reportService.getServiceReport(params);
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const totals = data?.totals || {};
  const services = data?.services || [];
  const maxRevenue = services[0]?.totalRevenue || 1;

  const profitMarginColor = (profit, revenue) => {
    if (!revenue) return 'text-gray-400';
    const pct = (profit / revenue) * 100;
    if (pct >= 50) return 'text-emerald-600';
    if (pct >= 25) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div>
      <PageHeader
        title="Service Detail Report"
        subtitle="Revenue, doctor fees, and profit breakdown per service"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <FiCalendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm border-none outline-none bg-transparent w-36"
              />
              <span className="text-gray-300">→</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-sm border-none outline-none bg-transparent w-36"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="btn-secondary text-xs px-3 py-2"
              >
                Clear
              </button>
            )}
          </div>
        }
      />

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={FiCalendar} label="Total Appointments" value={totals.totalAppointments?.toLocaleString() || '0'} color="blue" />
        <StatCard icon={FiDollarSign} label="Total Revenue" value={`LKR ${(totals.totalRevenue || 0).toLocaleString()}`} color="purple" />
        <StatCard icon={FiUsers} label="Total Doctor Fees" value={`LKR ${(totals.totalDoctorFees || 0).toLocaleString()}`} color="orange" />
        <StatCard icon={FiTrendingUp} label="Total Profit" value={`LKR ${(totals.totalProfit || 0).toLocaleString()}`} color="green" />
      </div>

      {loading ? (
        <Spinner />
      ) : services.length === 0 ? (
        <div className="card text-center py-16">
          <FiBarChart2 size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No data found for the selected period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-12 text-xs font-bold text-gray-400 uppercase tracking-wider px-5 py-2">
            <span className="col-span-3">Service</span>
            <span className="col-span-2 text-center">Appointments</span>
            <span className="col-span-2 text-right">Revenue</span>
            <span className="col-span-2 text-right">Doctor Fees</span>
            <span className="col-span-2 text-right">Profit</span>
            <span className="col-span-1 text-right">Margin</span>
          </div>

          {services.map((svc, idx) => {
            const margin = svc.totalRevenue > 0
              ? Math.round((svc.totalProfit / svc.totalRevenue) * 100)
              : 0;
            const isExpanded = expandedService === svc.serviceId;

            return (
              <div key={svc.serviceId} className="card overflow-hidden p-0">
                {/* Service row */}
                <button
                  type="button"
                  className="w-full text-left px-5 py-4 hover:bg-gray-50 transition"
                  onClick={() => setExpandedService(isExpanded ? null : svc.serviceId)}
                >
                  <div className="flex items-center justify-between lg:grid lg:grid-cols-12 gap-3">
                    {/* Name + rank */}
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-700'
                          : idx === 1 ? 'bg-gray-100 text-gray-600'
                          : idx === 2 ? 'bg-orange-100 text-orange-700'
                          : 'bg-primary-50 text-primary-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{svc.serviceName}</p>
                        <div className="mt-0.5">
                          <Bar value={svc.totalRevenue} max={maxRevenue} color="bg-primary-400" />
                        </div>
                      </div>
                    </div>

                    {/* Appointments */}
                    <div className="col-span-2 text-center hidden lg:block">
                      <Pill color="blue">{svc.totalAppointments} appts</Pill>
                    </div>

                    {/* Revenue */}
                    <div className="col-span-2 text-right hidden lg:block">
                      <p className="font-bold text-gray-900">LKR {svc.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">patient price</p>
                    </div>

                    {/* Doctor Fees */}
                    <div className="col-span-2 text-right hidden lg:block">
                      <p className="font-semibold text-orange-600">LKR {svc.totalDoctorFees.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">to doctors</p>
                    </div>

                    {/* Profit */}
                    <div className="col-span-2 text-right hidden lg:block">
                      <p className="font-bold text-emerald-600">LKR {svc.totalProfit.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-0.5">clinic profit</p>
                    </div>

                    {/* Margin */}
                    <div className="col-span-1 text-right hidden lg:flex items-center justify-end">
                      <span className={`text-sm font-bold ${profitMarginColor(svc.totalProfit, svc.totalRevenue)}`}>
                        {margin}%
                      </span>
                    </div>

                    {/* Mobile summary */}
                    <div className="flex flex-col items-end gap-1 lg:hidden">
                      <p className="font-bold text-gray-900 text-sm">LKR {svc.totalRevenue.toLocaleString()}</p>
                      <p className="text-xs text-emerald-600 font-semibold">+LKR {svc.totalProfit.toLocaleString()} profit</p>
                    </div>

                    {/* Expand toggle */}
                    <div className="ml-2 lg:ml-0 text-gray-400">
                      {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                    </div>
                  </div>
                </button>

                {/* Expanded — per-doctor breakdown */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Doctor Breakdown</p>

                    {/* Mobile stats */}
                    <div className="lg:hidden grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-white rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Appointments</p>
                        <p className="font-bold text-blue-600">{svc.totalAppointments}</p>
                      </div>
                      <div className="bg-white rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Revenue</p>
                        <p className="font-bold text-gray-900">LKR {svc.totalRevenue.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Doctor Fees</p>
                        <p className="font-bold text-orange-600">LKR {svc.totalDoctorFees.toLocaleString()}</p>
                      </div>
                      <div className="bg-white rounded-xl px-3 py-2 text-center">
                        <p className="text-xs text-gray-400">Clinic Profit ({margin}%)</p>
                        <p className="font-bold text-emerald-600">LKR {svc.totalProfit.toLocaleString()}</p>
                      </div>
                    </div>

                    {svc.doctors.length === 0 ? (
                      <p className="text-sm text-gray-400">No doctor data</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Doctor</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500">Appts</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Revenue</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Doctor Fee</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Profit</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Margin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {svc.doctors.sort((a, b) => b.revenue - a.revenue).map(doc => {
                              const docMargin = doc.revenue > 0 ? Math.round((doc.profit / doc.revenue) * 100) : 0;
                              return (
                                <tr key={doc.doctorId} className="hover:bg-white transition">
                                  <td className="py-2.5 px-3 font-medium text-gray-800">
                                    Dr. {doc.doctorName}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">{doc.appointments}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                                    LKR {doc.revenue.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-orange-600 font-semibold">
                                    LKR {doc.doctorFees.toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-emerald-600 font-semibold">
                                    LKR {doc.profit.toLocaleString()}
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-bold text-xs ${profitMarginColor(doc.profit, doc.revenue)}`}>
                                    {docMargin}%
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Grand total footer */}
          <div className="card bg-gray-900 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="font-bold text-lg">Grand Total</p>
              <div className="flex flex-wrap gap-6">
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Appointments</p>
                  <p className="font-bold text-white text-xl">{(totals.totalAppointments || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Revenue</p>
                  <p className="font-bold text-blue-300 text-xl">LKR {(totals.totalRevenue || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Doctor Fees</p>
                  <p className="font-bold text-orange-300 text-xl">LKR {(totals.totalDoctorFees || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Clinic Profit</p>
                  <p className="font-bold text-emerald-300 text-xl">LKR {(totals.totalProfit || 0).toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Profit Margin</p>
                  <p className={`font-bold text-xl ${totals.totalRevenue > 0 ? profitMarginColor(totals.totalProfit, totals.totalRevenue).replace('text-', 'text-') : 'text-gray-400'}`}>
                    {totals.totalRevenue > 0 ? Math.round((totals.totalProfit / totals.totalRevenue) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
