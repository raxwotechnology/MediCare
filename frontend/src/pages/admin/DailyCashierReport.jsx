import { useState, useEffect, useCallback } from 'react';
import { cashierReportService, appointmentService, walkInBillService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FiFileText, FiDollarSign, FiCalendar, FiCheckCircle, FiInfo,
  FiPieChart, FiTrendingDown, FiTrendingUp, FiHash, FiUser,
  FiPackage, FiShoppingCart, FiCreditCard, FiWifi, FiChevronDown, FiChevronUp
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

const PayMethodBadge = ({ method }) => {
  const styles = {
    cash:   'bg-emerald-50 text-emerald-700 border-emerald-100',
    card:   'bg-blue-50 text-blue-700 border-blue-100',
    online: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  const icons = { cash: FiDollarSign, card: FiCreditCard, online: FiWifi };
  const Icon = icons[method] || FiDollarSign;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${styles[method] || 'bg-gray-50 text-gray-600 border-gray-100'}`}>
      <Icon size={9} />{method || '—'}
    </span>
  );
};

const TotalsRow = ({ totals }) => (
  <div className="grid grid-cols-4 gap-2 mt-3">
    {[
      { label: 'Total',  value: totals.total,  cls: 'bg-gray-800 text-white' },
      { label: 'Cash',   value: totals.cash,   cls: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
      { label: 'Card',   value: totals.card,   cls: 'bg-blue-50 text-blue-700 border border-blue-100' },
      { label: 'Online', value: totals.online, cls: 'bg-purple-50 text-purple-700 border border-purple-100' },
    ].map(({ label, value, cls }) => (
      <div key={label} className={`rounded-xl p-3 text-center ${cls}`}>
        <p className="text-[9px] font-bold uppercase tracking-widest opacity-70 mb-1">{label}</p>
        <p className="text-sm font-display font-black">{fmt(value)}</p>
      </div>
    ))}
  </div>
);

const SectionHeader = ({ icon: Icon, title, total, open, onToggle, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-700',
    teal:   'bg-teal-50 text-teal-700',
    purple: 'bg-purple-50 text-purple-700',
    amber:  'bg-amber-50 text-amber-700',
  };
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={16} />
        </div>
        <span className="font-bold text-gray-800 text-sm">{title}</span>
        {total !== undefined && (
          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {fmt(total)}
          </span>
        )}
      </div>
      {open ? <FiChevronUp size={16} className="text-gray-400" /> : <FiChevronDown size={16} className="text-gray-400" />}
    </button>
  );
};

// ── Submission form (shared) ──────────────────────────────────────────────────
function SubmissionForm({ department, denominations, paymentBreakdown, cashierTotal, notes, submitting, alreadySubmitted, submittedBy, submittedAt, onDenomChange, onPaymentChange, onNotesChange, onSubmit }) {
  return (
    <div className="card h-fit sticky top-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={"w-10 h-10 rounded-xl flex items-center justify-center " + (alreadySubmitted ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600')}>
          {alreadySubmitted ? <FiCheckCircle size={20} /> : <FiDollarSign size={20} />}
        </div>
        <div>
          <h2 className="font-bold text-gray-900">{alreadySubmitted ? 'Report Submitted' : 'Submit Daily Report'}</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">
            {department === 'pharmacy' ? 'Pharmacy' : 'Reception'}
          </p>
        </div>
      </div>
      {alreadySubmitted && (
        <div className="mb-5 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-3 items-start">
          <FiCheckCircle className="text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-emerald-700">Already submitted for this date</p>
            {submittedBy && <p className="text-[11px] text-emerald-600 mt-0.5">By {submittedBy}{submittedAt ? ' at ' + new Date(submittedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' }) : ''}</p>}
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5">
        {!alreadySubmitted && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
            <FiInfo className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Enter denomination counts — cash total auto-calculates. Add card / online amounts manually.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Denominations</p>
          <div className="grid grid-cols-2 gap-3">
            {DENOMINATIONS.map((d) => (
              <div key={d.key} className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase">{d.val} Notes</label>
                <div className="relative">
                  <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                  <input
                    type="number" min="0" placeholder="0"
                    value={denominations[d.key]}
                    onChange={(e) => onDenomChange(d.key, e.target.value)}
                    disabled={alreadySubmitted}
                    className={"input-field pl-8 placeholder:text-gray-300" + (alreadySubmitted ? " opacity-60 cursor-not-allowed" : "")}
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
              <input type="number" placeholder="0.00" value={paymentBreakdown.card}
                onChange={(e) => onPaymentChange('card', e.target.value)} disabled={alreadySubmitted} className={"input-field" + (alreadySubmitted ? " opacity-60 cursor-not-allowed" : "")} />
            </div>
            <div>
              <label className="label-text">Online / Bank Transfers</label>
              <input type="number" placeholder="0.00" value={paymentBreakdown.online}
                onChange={(e) => onPaymentChange('online', e.target.value)} disabled={alreadySubmitted} className={"input-field" + (alreadySubmitted ? " opacity-60 cursor-not-allowed" : "")} />
            </div>
          </div>
        </div>

        <div>
          <label className="label-text">Notes (optional)</label>
          <textarea rows={2} placeholder="Any remarks for today..."
            value={notes} onChange={(e) => onNotesChange(e.target.value)}
            disabled={alreadySubmitted} className={"input-field resize-none" + (alreadySubmitted ? " opacity-60 cursor-not-allowed" : "")} />
        </div>

        <div className="pt-4 mt-2 border-t border-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-400">Total Submission</div>
          <div className="text-xl font-display font-black text-gray-900 border-b-2 border-indigo-500">
            {fmt(cashierTotal + paymentBreakdown.card + paymentBreakdown.online)}
          </div>
        </div>

        <button type="submit" disabled={submitting || alreadySubmitted}
          className={"w-full py-3 flex items-center justify-center gap-2 mt-4 rounded-xl font-semibold text-sm transition-all " + (alreadySubmitted ? "bg-emerald-100 text-emerald-700 cursor-not-allowed border border-emerald-200" : "btn-primary")}>
          {alreadySubmitted
            ? <><FiCheckCircle /> Report Already Submitted</>
            : submitting ? 'Submitting...' : <><FiCheckCircle /> Submit Final Report</>
          }
        </button>
      </form>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DailyCashierReport() {
  const { user } = useAuth();
  const isAdmin        = user?.role === 'admin';
  const isReceptionist = user?.role === 'receptionist';
  const isPharmacist   = user?.role === 'pharmacist';
  const department     = isPharmacist ? 'pharmacy' : (isReceptionist ? 'reception' : null);

  const [date, setDate]         = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]   = useState(false);
  const [summary, setSummary]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingReport, setExistingReport] = useState(null);

  // Detail data for staff
  const [appointments, setAppointments] = useState([]);
  const [walkInBills,  setWalkInBills]  = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Collapsible sections
  const [showAppts,      setShowAppts]      = useState(true);
  const [showPharmaBills, setShowPharmaBills] = useState(true);
  const [showWalkIns,    setShowWalkIns]    = useState(true);
  const [showExtraCharges, setShowExtraCharges] = useState(true);

  // Form state
  const [paymentBreakdown, setPaymentBreakdown] = useState({ cash: 0, card: 0, online: 0 });
  const [denominations, setDenominations] = useState({
    notes5000: 0, notes1000: 0, notes500: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0
  });
  const [notes, setNotes] = useState('');

  const cashierTotal = DENOMINATIONS.reduce((sum, d) => sum + (d.val * (denominations[d.key] || 0)), 0);

  // ── Fetchers ──────────────────────────────────────────────────────────────
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

  const fetchExistingReport = useCallback(async () => {
    if (!department) return;
    try {
      const res = await cashierReportService.getAll({ department, fromDate: date, toDate: date });
      const list = Array.isArray(res.data) ? res.data : [];
      const found = list.find(r => r.date === date && r.department === department) || null;
      setExistingReport(found);
      // Pre-fill form if a report already exists
      if (found) {
        setPaymentBreakdown(found.paymentBreakdown || { cash: 0, card: 0, online: 0 });
        setDenominations(found.denominations || { notes5000: 0, notes1000: 0, notes500: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0 });
        setNotes(found.notes || '');
      } else {
        setPaymentBreakdown({ cash: 0, card: 0, online: 0 });
        setDenominations({ notes5000: 0, notes1000: 0, notes500: 0, notes100: 0, notes50: 0, notes20: 0, notes10: 0 });
        setNotes('');
      }
    } catch {
      // silently ignore — not critical
    }
  }, [department, date]);

  const fetchReceptionistDetails = useCallback(async () => {
    if (!isReceptionist) return;
    setDetailLoading(true);
    try {
      const res  = await appointmentService.getAll({ date });
      const list = Array.isArray(res.data) ? res.data : (res.data?.appointments || []);
      // Only appointments where receptionist actually collected money
      setAppointments(list.filter(a => a.receptionPayment?.totalPaid > 0));
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setDetailLoading(false);
    }
  }, [isReceptionist, date]);

  const fetchPharmacistDetails = useCallback(async () => {
    if (!isPharmacist) return;
    setDetailLoading(true);
    try {
      // Appointment-based pharmacy bills
      const apptRes  = await appointmentService.getAll({ date });
      const apptList = Array.isArray(apptRes.data) ? apptRes.data : (apptRes.data?.appointments || []);
      setAppointments(apptList.filter(a => a.pharmacyBills?.some(b => b.isPaid)));

      // Walk-in bills for the date
      const walkRes  = await walkInBillService.getAll({ fromDate: date, toDate: date });
      const walkList = Array.isArray(walkRes.data) ? walkRes.data : (walkRes.data?.bills || []);
      setWalkInBills(walkList.filter(w => w.isPaid && !w.isDeleted));
    } catch {
      toast.error('Failed to load pharmacy bills');
    } finally {
      setDetailLoading(false);
    }
  }, [isPharmacist, date]);

  useEffect(() => { fetchSummary(); },             [fetchSummary]);
  useEffect(() => { fetchExistingReport(); },      [fetchExistingReport]);
  useEffect(() => { fetchReceptionistDetails(); }, [fetchReceptionistDetails]);
  useEffect(() => { fetchPharmacistDetails(); },   [fetchPharmacistDetails]);

  // ── Form handlers ─────────────────────────────────────────────────────────
  const handleDenomChange = (key, val) => {
    const n = parseInt(val) || 0;
    setDenominations(prev => {
      const updated  = { ...prev, [key]: n };
      const newTotal = DENOMINATIONS.reduce((s, d) => s + (d.val * (updated[d.key] || 0)), 0);
      setPaymentBreakdown(pb => ({ ...pb, cash: newTotal }));
      return updated;
    });
  };

  const handleManualPaymentChange = (key, val) =>
    setPaymentBreakdown(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!department && !isAdmin) return;
    setSubmitting(true);
    try {
      await cashierReportService.submit({ date, department: department || 'reception', paymentBreakdown, denominations, notes });
      toast.success('Cashier report submitted successfully');
      fetchSummary();
      fetchExistingReport();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Computed totals ───────────────────────────────────────────────────────
  const receptionTotals = appointments.reduce((acc, a) => {
    const p = a.receptionPayment;
    if (!p) return acc;
    acc.total += p.totalPaid || 0;
    (p.splits || []).forEach(s => { acc[s.method] = (acc[s.method] || 0) + s.amount; });
    return acc;
  }, { total: 0, cash: 0, card: 0, online: 0 });

  const extraChargeTotals = appointments.reduce((acc, a) => {
    (a.extraCharges || []).filter(c => c.isPaid).forEach(c => {
      acc.total += c.price || 0;
      (c.paymentSplits || []).forEach(s => { acc[s.method] = (acc[s.method] || 0) + s.amount; });
    });
    return acc;
  }, { total: 0, cash: 0, card: 0, online: 0 });

  const pharmaBillTotals = appointments.reduce((acc, a) => {
    (a.pharmacyBills || []).filter(b => b.isPaid).forEach(b => {
      acc.total += b.totalAmount || 0;
      (b.paymentSplits || []).forEach(s => { acc[s.method] = (acc[s.method] || 0) + s.amount; });
    });
    return acc;
  }, { total: 0, cash: 0, card: 0, online: 0 });

  const walkInTotals = walkInBills.reduce((acc, w) => {
    acc.total += w.totalAmount || 0;
    (w.paymentSplits || []).forEach(s => { acc[s.method] = (acc[s.method] || 0) + s.amount; });
    return acc;
  }, { total: 0, cash: 0, card: 0, online: 0 });

  const adminTotalRevenue  = summary ? (summary.extraIncomes.reduce((s, i) => s + i.amount, 0) + summary.cashierReports.reduce((s, r) => s + r.totalAmount, 0)) : 0;
  const adminTotalExpenses = summary ? summary.expenses.reduce((s, e) => s + e.amount, 0) : 0;

  const hasExtraCharges = appointments.some(a => a.extraCharges?.some(c => c.isPaid));

  // ── Spinner ───────────────────────────────────────────────────────────────
  const Spinner = () => (
    <div className="h-32 flex items-center justify-center">
      <div className="w-7 h-7 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Daily Cashier Report</h1>
          <p className="text-sm text-gray-500 mt-1">Submit or view end-of-day financial summaries</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <FiCalendar className="text-primary-500 ml-2" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="input-field border-none focus:ring-0 text-sm font-semibold" />
        </div>
      </div>

      {/* ── RECEPTIONIST ──────────────────────────────────────────────────── */}
      {isReceptionist && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SubmissionForm department={department} denominations={denominations}
              paymentBreakdown={paymentBreakdown} cashierTotal={cashierTotal}
              notes={notes} submitting={submitting}
              alreadySubmitted={!!existingReport}
              submittedBy={existingReport?.submittedBy?.name}
              submittedAt={existingReport?.updatedAt}
              onDenomChange={handleDenomChange} onPaymentChange={handleManualPaymentChange}
              onNotesChange={setNotes} onSubmit={handleSubmit} />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Appointment payments */}
            <SectionHeader icon={FiCalendar}
              title={`Appointment Payments (${appointments.length})`}
              total={receptionTotals.total} open={showAppts}
              onToggle={() => setShowAppts(v => !v)} color="indigo" />

            {showAppts && (
              <div className="card p-0 overflow-hidden">
                {detailLoading ? <Spinner /> : appointments.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 italic text-sm">No paid appointments for this date</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-indigo-50/60 text-indigo-900 border-b border-indigo-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase">#</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Patient</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Doctor / Service</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Payment</th>
                            <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {appointments.map((a, idx) => {
                            const p = a.receptionPayment;
                            return (
                              <tr key={a._id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-gray-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-gray-800">{a.patientName}</p>
                                  <p className="text-gray-400">{a.patientPhone}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-700">{a.doctorName}</p>
                                  <p className="text-gray-400">{a.serviceName}</p>
                                </td>
                                <td className="px-4 py-3">
                                  {p?.splits?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {p.splits.map((s, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                          <PayMethodBadge method={s.method} />
                                          <span className="text-gray-600 font-medium">{fmt(s.amount)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : <PayMethodBadge method={p?.paymentMethod} />}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(p?.totalPaid)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    a.status === 'completed' ? 'bg-emerald-50 text-emerald-700'
                                    : a.status === 'with_doctor' ? 'bg-blue-50 text-blue-700'
                                    : 'bg-amber-50 text-amber-700'}`}>
                                    {a.status.replace('_', ' ')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100">
                      <TotalsRow totals={receptionTotals} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Extra charges */}
            {hasExtraCharges && (
              <>
                <SectionHeader icon={FiPieChart}
                  title={`Extra Charges (paid)`}
                  total={extraChargeTotals.total} open={showExtraCharges}
                  onToggle={() => setShowExtraCharges(v => !v)} color="amber" />

                {showExtraCharges && (
                  <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-amber-50/60 text-amber-900 border-b border-amber-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase">Patient</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Service</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Payment</th>
                            <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50">
                          {appointments.flatMap(a =>
                            (a.extraCharges || []).filter(c => c.isPaid).map(c => (
                              <tr key={c._id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 font-medium text-gray-700">{a.patientName}</td>
                                <td className="px-4 py-3 text-gray-600">{c.serviceName}</td>
                                <td className="px-4 py-3">
                                  {c.paymentSplits?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {c.paymentSplits.map((s, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                          <PayMethodBadge method={s.method} />
                                          <span className="text-gray-600">{fmt(s.amount)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : <PayMethodBadge method={c.paymentMethod} />}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(c.price)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100">
                      <TotalsRow totals={extraChargeTotals} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── PHARMACIST ────────────────────────────────────────────────────── */}
      {isPharmacist && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SubmissionForm department={department} denominations={denominations}
              paymentBreakdown={paymentBreakdown} cashierTotal={cashierTotal}
              notes={notes} submitting={submitting}
              alreadySubmitted={!!existingReport}
              submittedBy={existingReport?.submittedBy?.name}
              submittedAt={existingReport?.updatedAt}
              onDenomChange={handleDenomChange} onPaymentChange={handleManualPaymentChange}
              onNotesChange={setNotes} onSubmit={handleSubmit} />
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* Appointment-based pharmacy bills */}
            <SectionHeader icon={FiPackage}
              title={`Appointment Pharmacy Bills (${appointments.reduce((s, a) => s + (a.pharmacyBills?.filter(b => b.isPaid).length || 0), 0)})`}
              total={pharmaBillTotals.total} open={showPharmaBills}
              onToggle={() => setShowPharmaBills(v => !v)} color="teal" />

            {showPharmaBills && (
              <div className="card p-0 overflow-hidden">
                {detailLoading ? <Spinner /> : appointments.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 italic text-sm">No pharmacy bills for this date</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-teal-50/60 text-teal-900 border-b border-teal-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase">Bill #</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Patient</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Medicines</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Payment</th>
                            <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {appointments.flatMap(a =>
                            (a.pharmacyBills || []).filter(b => b.isPaid).map(b => (
                              <tr key={b._id} className="hover:bg-gray-50/50">
                                <td className="px-4 py-3 text-gray-400 font-mono">#{b.billNumber || '—'}</td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-gray-800">{a.patientName}</p>
                                  <p className="text-gray-400">{a.patientPhone}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {(b.medicines || []).map((m, i) => (
                                      <span key={i} className="bg-teal-50 text-teal-700 border border-teal-100 px-1.5 py-0.5 rounded text-[10px]">
                                        {m.name} ×{m.quantity}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {b.paymentSplits?.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {b.paymentSplits.map((s, i) => (
                                        <span key={i} className="flex items-center gap-1">
                                          <PayMethodBadge method={s.method} />
                                          <span className="text-gray-600 font-medium">{fmt(s.amount)}</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : <PayMethodBadge method={b.paymentMethod} />}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(b.totalAmount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100">
                      <TotalsRow totals={pharmaBillTotals} />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Walk-in bills */}
            <SectionHeader icon={FiShoppingCart}
              title={`Walk-In Patient Bills (${walkInBills.length})`}
              total={walkInTotals.total} open={showWalkIns}
              onToggle={() => setShowWalkIns(v => !v)} color="purple" />

            {showWalkIns && (
              <div className="card p-0 overflow-hidden">
                {detailLoading ? <Spinner /> : walkInBills.length === 0 ? (
                  <div className="py-10 text-center text-gray-400 italic text-sm">No walk-in bills for this date</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-purple-50/60 text-purple-900 border-b border-purple-100">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase">Bill #</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Customer</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Items</th>
                            <th className="px-4 py-3 text-left font-bold uppercase">Payment</th>
                            <th className="px-4 py-3 text-right font-bold uppercase">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {walkInBills.map(w => (
                            <tr key={w._id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3 text-gray-400 font-mono">#{w.billNumber}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                    <FiUser size={10} className="text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-800">{w.customerName}</p>
                                    {w.customerPhone && <p className="text-gray-400">{w.customerPhone}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(w.medicines || []).map((m, i) => (
                                    <span key={i} className="bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded text-[10px]">
                                      {m.name} ×{m.quantity}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                {w.paymentSplits?.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {w.paymentSplits.map((s, i) => (
                                      <span key={i} className="flex items-center gap-1">
                                        <PayMethodBadge method={s.method} />
                                        <span className="text-gray-600 font-medium">{fmt(s.amount)}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : <PayMethodBadge method={w.paymentMethod} />}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-gray-800">{fmt(w.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-4 border-t border-gray-100">
                      <TotalsRow totals={walkInTotals} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN ─────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="space-y-6">
          {loading ? (
            <div className="card h-64 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card flex items-center gap-4 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-indigo-100">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><FiTrendingUp size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-widest">Total Revenue</p>
                    <p className="text-xl font-display font-black mt-0.5">{fmt(adminTotalRevenue)}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4 border-red-100">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500"><FiTrendingDown size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Expenses</p>
                    <p className="text-xl font-display font-bold text-gray-900 mt-0.5">{fmt(adminTotalExpenses)}</p>
                  </div>
                </div>
                <div className="card flex items-center gap-4 border-emerald-100">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500"><FiPieChart size={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Net Cashflow</p>
                    <p className={`text-xl font-display font-bold mt-0.5 ${adminTotalRevenue >= adminTotalExpenses ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(adminTotalRevenue - adminTotalExpenses)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <FiFileText size={14} /> Department Reports
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['reception', 'pharmacy'].map(dept => {
                    const r   = summary.cashierReports.find(cr => cr.department === dept);
                    const sys = summary.systemCalculated[dept];
                    return (
                      <div key={dept} className="card bg-white border border-gray-100 overflow-hidden">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        )) : <tr><td colSpan="2" className="px-4 py-8 text-center text-gray-400 italic">No extra income for today</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                        )) : <tr><td colSpan="2" className="px-4 py-8 text-center text-gray-400 italic">No expenses recorded today</td></tr>}
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
      )}
    </div>
  );
}
