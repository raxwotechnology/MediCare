import { useState, useEffect, useCallback } from 'react';
import { cashierReportService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiFileText, FiDollarSign, FiCalendar, FiCheckCircle, FiInfo,
  FiArrowRight, FiPieChart, FiTrendingDown, FiTrendingUp, FiHash
} from 'react-icons/fi';

const DENOMINATIONS = [
  { val: 5000, key: 'notes5000' },
  { val: 1000, key: 'notes1000' },
  { val: 500,  key: 'notes500'  },
  { val: 100,  key: 'notes100'  },
  { val: 50,   key: 'notes50'   },
  { val: 20,   key: 'notes20'   },
  { val: 10,   key: 'notes10'   },
];

const fmt = (n) => Number(n || 0).toLocaleString('en-LK', { style: 'currency', currency: 'LKR' });

export default function DailyCashierReport() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const department = user?.role === 'pharmacist' ? 'pharmacy' : (user?.role === 'receptionist' ? 'reception' : null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [paymentBreakdown, setPaymentBreakdown] = useState({ cash: 0, card: 0, online: 0 });
  const [denominations, setDenominations] = useState({
    notes5000: 0, notes1000: 0, notes500: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0
  });
  const [notes, setNotes] = useState('');

  const cashierTotal = DENOMINATIONS.reduce((sum, d) => sum + (d.val * (denominations[d.key] || 0)), 0);

  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await cashierReportService.getSummary(date);
      setSummary(res.data);
    } catch {
      toast.error('Failed to load daily summary');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, date]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleDenomChange = (key, val) => {
    const n = parseInt(val) || 0;
    setDenominations(prev => {
      const updated = { ...prev, [key]: n };
      const newTotal = DENOMINATIONS.reduce((sum, d) => sum + (d.val * (updated[d.key] || 0)), 0);
      setPaymentBreakdown(pb => ({ ...pb, cash: newTotal }));
      return updated;
    });
  };

  const handleManualPaymentChange = (key, val) => {
    setPaymentBreakdown(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!department && !isAdmin) return;
    
    setSubmitting(true);
    try {
      await cashierReportService.submit({
        date,
        department: department || 'reception', // Admin can submit for testing or as backup
        paymentBreakdown,
        denominations,
        notes
      });
      toast.success('Cashier report submitted successfully');
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalRevenue = summary ? (summary.extraIncomes.reduce((s, i) => s + i.amount, 0) + summary.cashierReports.reduce((s, r) => s + r.totalAmount, 0)) : 0;
  const totalExpenses = summary ? summary.expenses.reduce((s, e) => s + e.amount, 0) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Daily Cashier Report</h1>
          <p className="text-sm text-gray-500 mt-1">Submit or view end-of-day financial summaries</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <FiCalendar className="text-primary-500 ml-2" />
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="input-field border-none focus:ring-0 text-sm font-semibold"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SUBMISSION FORM (For Pharmacist/Receptionist) */}
        {(!isAdmin || (isAdmin && !summary)) && (
          <div className="lg:col-span-1">
            <div className="card h-fit sticky top-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <FiDollarSign size={20} />
                </div>
                <h2 className="font-bold text-gray-900">Submit Daily Report</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                  <FiInfo className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Enter the breakdown of cash denominations. The cash total will be calculated automatically.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Denominations</p>
                  <div className="grid grid-cols-2 gap-3">
                    {DENOMINATIONS.map((d) => (
                      <div key={d.key} className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">{d.val} Notes</label>
                        <div className="relative">
                          <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0"
                            value={denominations[d.key]}
                            onChange={(e) => handleDenomChange(d.key, e.target.value)}
                            className="input-field pl-8 placeholder:text-gray-300"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Methods</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-600">Cash Total</span>
                      <span className="font-display font-bold text-indigo-600">{fmt(cashierTotal)}</span>
                    </div>
                    <div>
                      <label className="label-text">Card Payments</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={paymentBreakdown.card}
                        onChange={(e) => handleManualPaymentChange('card', e.target.value)}
                        className="input-field" 
                      />
                    </div>
                    <div>
                      <label className="label-text">Online / Bank Transfers</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={paymentBreakdown.online}
                        onChange={(e) => handleManualPaymentChange('online', e.target.value)}
                        className="input-field" 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-gray-50 flex items-center justify-between">
                  <div className="text-xs text-gray-400">Total Submission</div>
                  <div className="text-xl font-display font-black text-gray-900 border-b-2 border-indigo-500">
                    {fmt(cashierTotal + paymentBreakdown.card + paymentBreakdown.online)}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? 'Submitting...' : <><FiCheckCircle /> Submit Final Report</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ADMIN VIEW / SUMMARY */}
        <div className={`lg:col-span-2 space-y-6 ${!isAdmin && 'hidden lg:block opacity-40 grayscale pointer-events-none'}`}>
          {loading ? (
            <div className="card h-64 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : summary ? (
            <>
              {/* Financial Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card flex items-center gap-4 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-indigo-100">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><FiTrendingUp size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Total Revenue</p>
                    <p className="text-xl font-display font-black mt-0.5">{fmt(totalRevenue)}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4 border-red-100">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500"><FiTrendingDown size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Expenses</p>
                    <p className="text-xl font-display font-bold text-gray-900 mt-0.5">{fmt(totalExpenses)}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4 border-emerald-100">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500"><FiPieChart size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Net Cashflow</p>
                    <p className={`text-xl font-display font-bold mt-0.5 ${totalRevenue >= totalExpenses ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(totalRevenue - totalExpenses)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Department Reports */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <FiFileText size={14} /> Department Reports
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['reception', 'pharmacy'].map(dept => {
                    const r = summary.cashierReports.find(cr => cr.department === dept);
                    const sys = summary.systemCalculated[dept];
                    return (
                      <div key={dept} className="card bg-white border border-gray-100 overflow-hidden group">
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${dept === 'pharmacy' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>
                            {dept}
                          </span>
                          {r ? (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-md">
                              <FiCheckCircle size={10} /> Submitted by {r.submittedBy.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded-md italic">Pending Submission</span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold text-gray-400 uppercase mb-1">
                            <span>Method</span><span>Reported</span><span>Expected</span>
                          </div>
                          {['cash', 'card', 'online'].map(method => (
                            <div key={method} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                              <span className="text-gray-500 capitalize">{method}</span>
                              <span className="font-semibold text-gray-800">{r ? fmt(r.paymentBreakdown[method]) : '—'}</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-500 font-mono">{fmt(sys[method])}</span>
                            </div>
                          ))}
                        </div>

                        {r && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cash Breakup</p>
                            <div className="flex flex-wrap gap-1.5">
                              {DENOMINATIONS.map(d => (
                                r.denominations[d.key] > 0 && (
                                  <div key={d.key} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                                    <span className="text-gray-400 mr-1">{d.val}:</span>
                                    <span className="font-bold text-gray-700">{r.denominations[d.key]}</span>
                                  </div>
                                )
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Extra Income */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                    <FiTrendingUp size={14} /> Other Income
                  </h3>
                  <div className="card p-0 overflow-hidden border-emerald-50">
                    <table className="w-full text-xs">
                      <thead className="bg-emerald-50/50 text-emerald-900 border-b border-emerald-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold uppercase">Source</th>
                          <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {summary.extraIncomes.length > 0 ? summary.extraIncomes.map(i => (
                          <tr key={i._id}>
                            <td className="px-4 py-3 text-gray-600 font-medium">{i.title}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmt(i.amount)}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan="2" className="px-4 py-8 text-center text-gray-400 italic">No extra income for today</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Expenses */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-red-700 uppercase tracking-widest flex items-center gap-2">
                    <FiTrendingDown size={14} /> Expenses
                  </h3>
                  <div className="card p-0 overflow-hidden border-red-50">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50/50 text-red-900 border-b border-red-100">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold uppercase">Category</th>
                          <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-50">
                        {summary.expenses.length > 0 ? summary.expenses.map(e => (
                          <tr key={e._id}>
                            <td className="px-4 py-3 text-gray-600 font-medium">{e.category}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(e.amount)}</td>
                          </tr>
                        )) : (
                          <tr><td colSpan="2" className="px-4 py-8 text-center text-gray-400 italic">No expenses recorded today</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card h-96 flex flex-col items-center justify-center text-center">
              <FiInfo size={48} className="text-gray-200 mb-4" />
              <p className="text-gray-500 font-bold text-lg">No summary for this date</p>
              <p className="text-sm text-gray-400 max-w-xs mt-2 italic">Select a different date or wait for staff to submit their reports.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
