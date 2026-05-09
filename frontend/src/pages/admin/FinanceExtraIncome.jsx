import { useState, useEffect } from 'react';
import { financeService } from '../../services';
import { PageHeader, Modal, Spinner, EmptyState } from '../../components/common';
import SplitPaymentInput, { PAYMENT_METHODS_EXTENDED, formatSplits } from '../../components/common/SplitPaymentInput';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export default function FinanceExtraIncome() {
  const [incomes, setIncomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialForm = () => ({
    title: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    source: 'Miscellaneous',
    description: '',
  });
  const [form, setForm] = useState(initialForm());
  const [splits, setSplits] = useState([{ method: 'cash', amount: 0 }]);

  const sources = ['Donation', 'Sponsorship', 'Investment', 'Miscellaneous'];

  const fetch = async () => {
    try {
      setLoading(true);
      const res = await financeService.getExtraIncome();
      setIncomes(res.data);
    } catch (err) {
      toast.error('Failed to load extra income');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openModal = () => {
    setForm(initialForm());
    setSplits([{ method: 'cash', amount: 0 }]);
    setShowModal(true);
  };

  const totalDue = Number(form.amount) || 0;
  const splitTotal = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const isBalanced = totalDue > 0 && Math.abs(splitTotal - totalDue) < 0.01;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) return toast.error('Title and amount required');
    if (!isBalanced) return toast.error('Payment splits must equal the total amount');

    setSaving(true);
    try {
      await financeService.createExtraIncome({
        ...form,
        amount: Number(form.amount),
        paymentSplits: splits.map(s => ({ method: s.method, amount: Number(s.amount) })),
      });
      toast.success('Extra income recorded');
      setShowModal(false);
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save income record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this income record?')) return;
    try {
      await financeService.deleteExtraIncome(id);
      toast.success('Record deleted');
      fetch();
    } catch (err) {
      toast.error('Error deleting record');
    }
  };

  return (
    <div>
      <PageHeader
        title="Extra Income"
        subtitle="Manage and track additional clinic revenue streams"
        action={
          <button onClick={openModal} className="btn-success flex items-center gap-2">
            <FiPlus size={16} /> Record Income
          </button>
        }
      />

      {loading ? <Spinner /> : (
        <div className="card mt-6 border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
          {incomes.length === 0 ? <EmptyState message="No extra income records found" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Source</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Recorded By</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Method</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Amount (LKR)</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incomes.map((inc) => (
                    <tr key={inc._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700 whitespace-nowrap">{inc.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{inc.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">{inc.source || 'Miscellaneous'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-500">{inc.recordedBy?.name || 'Admin'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-gray-500">
                        {formatSplits(inc.paymentSplits, inc.paymentMethod)}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right whitespace-nowrap">
                        + {Number(inc.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(inc._id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Record Extra Income">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="input-field font-semibold" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Source</label>
              <select value={form.source} onChange={e => setForm({...form, source: e.target.value})} className="input-field font-semibold">
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
            <input type="text" placeholder="E.g., Medical Camp Sponsorship" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="input-field font-semibold" required />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Description (Optional)</label>
            <textarea placeholder="Additional details..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field font-semibold resize-none h-20" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Amount (LKR)</label>
            <input type="number" min="0" step="0.01" placeholder="0" value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              className="input-field font-bold text-emerald-600 text-lg" required />
          </div>

          <SplitPaymentInput
            totalDue={totalDue}
            value={splits}
            onChange={setSplits}
            accent="emerald"
            methods={PAYMENT_METHODS_EXTENDED}
          />

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
            <button type="submit" disabled={saving || !isBalanced} className="btn-success flex-1 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : 'Record Income'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
