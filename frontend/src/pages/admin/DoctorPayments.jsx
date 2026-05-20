import { useState, useEffect } from 'react';
import { paymentService, doctorService, appointmentService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState, StatCard } from '../../components/common';
import SplitPaymentInput, { PAYMENT_METHODS_EXTENDED, formatSplits } from '../../components/common/SplitPaymentInput';
import toast from 'react-hot-toast';
import { FiDollarSign, FiPlus, FiCheck, FiTrash2 } from 'react-icons/fi';

export default function DoctorPayments() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ doctorId: '', amount: '', periodStart: '', periodEnd: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('pending');

  // Pay-out modal — split aware
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedForPay, setSelectedForPay] = useState(null);
  const [paySplits, setPaySplits] = useState([]);
  const [payChange, setPayChange] = useState(0);

  const fetch = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, dRes] = await Promise.all([paymentService.getAll(), paymentService.getSummary(), doctorService.getAll()]);
      setPayments(pRes.data); setSummary(sRes.data); setDoctors(dRes.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await paymentService.create({ doctorId: form.doctorId, amount: Number(form.amount), periodStart: form.periodStart, periodEnd: form.periodEnd, notes: form.notes });
      toast.success('Payment record created'); setShowModal(false); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const openPayModal = (p) => {
    setSelectedForPay(p);
    setPaySplits([{ method: 'cash', amount: Number(p.amount) }]);
    setPayChange(0);
    setShowPayModal(true);
  };

  const handlePay = async (e) => {
    if (e) e.preventDefault();
    const total = paySplits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    if (total < selectedForPay.amount - 0.01) {
      return toast.error(`Tendered total (LKR ${total.toFixed(2)}) is less than amount (LKR ${Number(selectedForPay.amount).toFixed(2)})`);
    }
    setSaving(true);
    try {
      await paymentService.markPaid(selectedForPay._id, {
        paymentSplits: paySplits,
      });
      toast.success(payChange > 0
        ? `Paid ${selectedForPay.doctor?.designation || 'Dr.'} ${selectedForPay.doctor?.name || ''} — change LKR ${payChange.toFixed(2)}`
        : 'Payment marked as paid');
      setShowPayModal(false);
      fetch();
    }
    catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this pending payment record? This action cannot be undone.')) return;
    try {
      await paymentService.delete(id);
      toast.success('Payment record deleted');
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error deleting'); }
  };

  const filtered = payments.filter(p => p.status === tab);
  const totalEarned = summary.reduce((s, d) => s + (d.totalEarned || 0), 0);
  const totalPaid = summary.reduce((s, d) => s + d.paidAmount, 0);
  const totalPending = totalEarned - totalPaid;

  return (
    <div>
      <PageHeader title="Doctor Payments" subtitle="Track and manage doctor earnings"
        action={<button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2"><FiPlus size={16} />New Payment</button>} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={FiDollarSign} label="Total Earned" value={`LKR ${totalEarned.toLocaleString()}`} color="blue" />
        <StatCard icon={FiDollarSign} label="Total Paid Out" value={`LKR ${totalPaid.toLocaleString()}`} color="green" />
        <StatCard icon={FiDollarSign} label="Total Pending" value={`LKR ${totalPending.toLocaleString()}`} color="orange" />
      </div>

      {/* Per-doctor summary */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Earnings Summary by Doctor</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Doctor</th><th>Total Earned</th><th>Paid Out</th><th>Pending (Owed)</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map(d => {
                const earned = d.totalEarned || 0;
                const paid = d.paidAmount || 0;
                const pending = earned - paid;
                return (
                  <tr key={d.doctor._id}>
                    <td className="font-medium">{d.doctor?.designation || 'Dr.'} {d.doctor?.name || d.doctorName || 'Deleted'}</td>
                    <td className="text-blue-600 font-semibold">LKR {earned.toLocaleString()}</td>
                    <td className="text-emerald-600 font-semibold">LKR {paid.toLocaleString()}</td>
                    <td className="font-bold">
                      <span className={pending > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        LKR {pending.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {['pending', 'paid'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition capitalize ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Doctor</th><th>Amount</th><th>Period</th><th>Method</th><th>Notes</th>{tab === 'pending' && <th>Action</th>}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? <tr><td colSpan={6}><EmptyState message={`No ${tab} payments`} /></td></tr>
                : filtered.map(p => (
                  <tr key={p._id}>
                    <td className="font-medium">{p.doctor?.designation || 'Dr.'} {p.doctor?.name || p.doctorName || 'Deleted'}</td>
                    <td className="font-bold text-primary-600">
                      LKR {p.amount?.toLocaleString()}
                      {p.status === 'paid' && Number(p.changeGiven) > 0 && (
                        <span className="block text-[10px] font-medium text-emerald-600">
                          Tendered LKR {Number(p.totalTendered || p.cashTendered).toFixed(2)}, change LKR {Number(p.changeGiven).toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="text-gray-500 text-xs">{p.periodStart?.split('T')[0]} → {p.periodEnd?.split('T')[0]}</td>
                    <td className="text-gray-500 text-xs">
                      {p.status === 'paid' ? formatSplits(p.paymentSplits, p.paymentMethod) : '—'}
                    </td>
                    <td className="text-gray-400 text-xs">{p.notes || '—'}</td>
                    {tab === 'pending' && (
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openPayModal(p)} className="btn-success flex items-center gap-1 text-xs py-1.5 px-3"><FiCheck size={13} />Pay</button>
                          <button onClick={() => handleDelete(p._id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pay Confirmation Modal — split-payment aware */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Confirm Payment" size="md">
        {selectedForPay && (
          <form onSubmit={handlePay} className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Paying To</p>
              <p className="font-bold text-gray-900">{selectedForPay.doctor?.designation || 'Dr.'} {selectedForPay.doctor?.name || selectedForPay.doctorName || 'Deleted'}</p>
              <p className="text-2xl font-display font-black text-primary-600 mt-1">LKR {selectedForPay.amount?.toLocaleString()}</p>
            </div>

            <SplitPaymentInput
              totalDue={Number(selectedForPay.amount)}
              value={paySplits}
              onChange={setPaySplits}
              accent="primary"
              methods={PAYMENT_METHODS_EXTENDED}
              onChangeGiven={setPayChange}
            />

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowPayModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={saving} className="btn-success flex-1">{saving ? 'Processing...' : 'Confirm & Pay'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Payment Record">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Doctor *</label>
            <select value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} className="input-field" required>
              <option value="">Select doctor</option>
              {doctors.map(d => {
                const docSummary = summary.find(s => s.doctor._id === d._id);
                const pending = docSummary ? (docSummary.totalEarned || 0) - (docSummary.paidAmount || 0) : null;
                return (
                  <option key={d._id} value={d._id}>
                    {d.designation || 'Dr.'} {d.name}{pending !== null ? ` — Pending: LKR ${pending.toLocaleString()}` : ''}
                  </option>
                );
              })}
            </select>
            {form.doctorId && (() => {
              const docSummary = summary.find(s => s.doctor._id === form.doctorId);
              if (!docSummary) return null;
              const earned = docSummary.totalEarned || 0;
              const paid = docSummary.paidAmount || 0;
              const pending = earned - paid;
              return (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 grid grid-cols-3 sm:grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Earned</p>
                    <p className="font-bold text-blue-600 text-sm mt-0.5">LKR {earned.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Paid Out</p>
                    <p className="font-bold text-emerald-600 text-sm mt-0.5">LKR {paid.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pending</p>
                    <p className={`font-bold text-sm mt-0.5 ${pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>LKR {pending.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Amount (LKR) *</label>
            <input type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" required /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input type="date" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} className="input-field" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input type="date" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} className="input-field" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} /></div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
