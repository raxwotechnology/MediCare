import { useState, useEffect, useCallback } from 'react';
import { walkInBillService } from '../../services';
import SplitPaymentInput, { formatSplits } from '../../components/common/SplitPaymentInput';
import CreatableSelect from '../../components/common/CreatableSelect';
import toast from 'react-hot-toast';
import {
  FiPlus, FiTrash2, FiSearch, FiPrinter, FiDownload,
  FiPackage, FiDollarSign,
  FiCheck, FiX, FiBarChart2, FiShoppingCart,
  FiUser,
} from 'react-icons/fi';

/* ── Clinic info ── */
const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

/* ── Logo helper ── */
const getLogoBase64 = async () => {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
};

/* ── Build bill HTML ── */
const buildBillHtml = (bill, logoSrc) => {
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${CLINIC.name}" style="height:64px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : '';
  const rows = bill.medicines.map(m => `
    <tr>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0">${m.name}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${m.quantity}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;text-align:right">LKR ${Number(m.price).toFixed(2)}</td>
      <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;text-align:right">LKR ${(m.price * m.quantity).toFixed(2)}</td>
    </tr>`).join('');

  // Show payment breakdown if multiple methods were used
  const splits = bill.paymentSplits || [];
  let paymentDetail = '';
  if (bill.isPaid) {
    if (splits.length > 1) {
      paymentDetail = splits.map(s =>
        `<div style="color:#6b7280;font-size:12px;text-transform:capitalize">${s.method}: LKR ${Number(s.amount).toFixed(2)}</div>`
      ).join('');
    } else {
      paymentDetail = `<div style="color:#6b7280;margin-top:4px;font-size:12px;text-transform:capitalize">${bill.paymentMethod}</div>`;
    }
    if (Number(bill.changeGiven) > 0) {
      const tendered = Number(bill.totalTendered || bill.cashTendered || 0);
      paymentDetail += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d1d5db;color:#374151;font-size:12px">
        <div>Tendered: <strong>LKR ${tendered.toFixed(2)}</strong></div>
        <div style="color:#047857">Change: <strong>LKR ${Number(bill.changeGiven).toFixed(2)}</strong></div>
      </div>`;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Walk-In Bill #WI-${String(bill.billNumber).padStart(4,'0')}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;color:#1a1a1a;font-size:13px}
    .header{text-align:center;border-bottom:2px solid #059669;padding-bottom:14px;margin-bottom:16px}
    .clinic-name{font-size:22px;font-weight:800;color:#059669;margin-bottom:2px}
    .clinic-sub{font-size:12px;color:#4b5563;line-height:1.6}
    .meta{display:flex;justify-content:space-between;margin-bottom:14px;gap:16px}
    .meta-box{flex:1;background:#f0fdf4;padding:10px 12px;border-radius:8px}
    .meta-label{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600}
    .meta-value{font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    thead{background:#059669;color:#fff}
    thead th{padding:8px;text-align:left;font-size:12px}
    .total-row{background:#ecfdf5;font-weight:800}
    .total-row td{padding:10px 8px;font-size:15px}
    .status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .paid{background:#d1fae5;color:#065f46} .unpaid{background:#fef3c7;color:#92400e}
    .walkin-badge{display:inline-block;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-top:6px}
    .footer{margin-top:20px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:10px}
    @media print{body{padding:10px}}
  </style></head><body>
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div style="font-size:15px;font-weight:700;margin:10px 0 2px">Walk-In Pharmacy Bill — #WI-${String(bill.billNumber).padStart(4,'0')}</div>
    <div style="font-size:12px;color:#6b7280">${new Date(bill.createdAt).toLocaleString()}</div>
  </div>
  <div class="meta">
    <div class="meta-box"><div class="meta-label">Customer</div><div class="meta-value">${bill.customerName}</div>${bill.customerPhone ? `<div style="color:#6b7280;font-size:12px">${bill.customerPhone}</div>` : ''}<div class="walkin-badge">Walk-In (No Prescription)</div></div>
    <div class="meta-box"><div class="meta-label">Payment</div>
      <div class="meta-value"><span class="status ${bill.isPaid ? 'paid' : 'unpaid'}">${bill.isPaid ? '✓ Paid' : 'Pending'}</span></div>
      ${paymentDetail}
    </div>
  </div>
  <table><thead><tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="3" style="padding:10px 8px;text-align:right">Grand Total</td>
      <td style="padding:10px 8px;text-align:right;color:#059669">LKR ${Number(bill.totalAmount).toFixed(2)}</td></tr>
      ${bill.isPaid && Number(bill.changeGiven) > 0 ? `
      <tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#374151">Tendered</td>
        <td style="padding:6px 8px;text-align:right;color:#374151">LKR ${Number(bill.totalTendered || bill.cashTendered || 0).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="padding:6px 8px;text-align:right;font-weight:700;color:#047857">Change Returned</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:#047857">LKR ${Number(bill.changeGiven).toFixed(2)}</td></tr>
      ` : ''}
    </tfoot>
  </table>
  ${bill.notes ? `<div style="margin-top:12px;padding:10px;background:#f0fdf4;border-radius:6px;font-size:12px"><strong>Notes:</strong> ${bill.notes}</div>` : ''}
  <div class="footer">${CLINIC.name} &bull; Walk-In Pharmacy &bull; No Prescription Required &bull; Computer-generated</div>
</body></html>`;
};

/* ── Summary Card ── */
function SCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`card flex items-center gap-4 border-l-4 ${color}`}>
      <div className="w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center flex-shrink-0">
        <Icon size={22} className="text-current opacity-80" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-gray-900 mt-0.5 leading-none">{value}</p>
      </div>
    </div>
  );
}

const EMPTY_FORM = { customerName: '', customerPhone: '', notes: '' };
const EMPTY_MED  = { name: '', price: '', quantity: 1 };

export default function PharmacyWalkIn() {
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showPay, setShowPay] = useState(null); // bill object
  const [form, setForm] = useState(EMPTY_FORM);
  const [meds, setMeds] = useState([{ ...EMPTY_MED }]);
  const [paySplits, setPaySplits] = useState([]);
  const [payChange, setPayChange] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  // Previously used medicine names for creatable suggestions
  const [medSuggestions, setMedSuggestions] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterPaid, setFilterPaid] = useState('');
  const [tab, setTab] = useState('all');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterFrom) params.fromDate = filterFrom;
      if (filterTo) params.toDate = filterTo;
      if (filterPaid !== '') params.isPaid = filterPaid;
      const [bRes, sRes] = await Promise.all([
        walkInBillService.getAll(params),
        walkInBillService.getSummary(),
      ]);
      setBills(bRes.data);
      setSummary(sRes.data);
      // Build unique medicine name suggestions from all bills (no filter)
      const allBills = bRes.data;
      const nameSet = new Set();
      allBills.forEach(b => (b.medicines || []).forEach(m => { if (m.name) nameSet.add(m.name); }));
      setMedSuggestions([...nameSet].sort());
    } catch { toast.error('Failed to load bills'); }
    finally { setLoading(false); }
  }, [search, filterFrom, filterTo, filterPaid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* Meds row helpers */
  const addRow = () => setMeds(p => [...p, { ...EMPTY_MED }]);
  const removeRow = (i) => setMeds(p => p.filter((_, idx) => idx !== i));
  const updateMed = (i, field, val) => setMeds(p => p.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  const total = meds.reduce((s, m) => s + (parseFloat(m.price || 0) * parseInt(m.quantity || 1)), 0);

  const handleFormChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    const valid = meds.filter(m => m.name.trim() && m.price);
    if (!valid.length) return toast.error('Add at least one medicine with a price.');
    setSaving(true);
    try {
      await walkInBillService.create({
        ...form,
        medicines: valid.map(m => ({ name: m.name.trim(), price: parseFloat(m.price), quantity: parseInt(m.quantity) })),
      });
      toast.success('Walk-in bill created!');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setMeds([{ ...EMPTY_MED }]);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally { setSaving(false); }
  };

  const openPayModal = (bill) => {
    setShowPay(bill);
    setPaySplits([{ method: 'cash', amount: Number(bill.totalAmount) }]);
    setPayChange(0);
  };

  const handlePay = async () => {
    if (!showPay) return;
    const sum = paySplits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    if (sum < showPay.totalAmount - 0.01) {
      return toast.error(`Tendered total (LKR ${sum.toFixed(2)}) is less than bill (LKR ${Number(showPay.totalAmount).toFixed(2)})`);
    }
    setPaying(true);
    try {
      await walkInBillService.pay(showPay._id, {
        splits: paySplits,
      });
      toast.success(payChange > 0
        ? `Bill #WI-${String(showPay.billNumber).padStart(4,'0')} paid — change LKR ${payChange.toFixed(2)}`
        : `Bill #WI-${String(showPay.billNumber).padStart(4,'0')} paid ✓`);
      setShowPay(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally { setPaying(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    try {
      await walkInBillService.delete(id);
      toast.success('Bill deleted');
      fetchAll();
    } catch { toast.error('Delete failed'); }
  };

  const handlePrint = async (b) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(buildBillHtml(b, logo));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const handleDownload = async (b) => {
    const logo = await getLogoBase64();
    const blob = new Blob([buildBillHtml(b, logo)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `walkin-bill-${b.customerName.replace(/\s+/g, '-')}-WI${b.billNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bill downloaded!');
  };

  const clearFilters = () => { setSearch(''); setFilterFrom(''); setFilterTo(''); setFilterPaid(''); };

  const displayed = tab === 'unpaid' ? bills.filter(b => !b.isPaid) : bills;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Walk-In Pharmacy</h1>
          <p className="text-sm text-gray-500 mt-1">Issue bills directly to customers — no prescription required</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> New Walk-In Bill
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SCard icon={FiShoppingCart} label="Total Bills" value={summary.total} color="border-emerald-500 text-emerald-600" />
          <SCard icon={FiDollarSign} label="Revenue" value={`LKR ${Number(summary.totalRevenue||0).toLocaleString()}`} color="border-teal-500 text-teal-600" />
          <SCard icon={FiCheck} label="Paid" value={summary.paid} color="border-primary-500 text-primary-600" />
          <SCard icon={FiBarChart2} label="Pending" value={summary.pending} color="border-amber-500 text-amber-600" />
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {[{ key:'all', label:`All (${bills.length})` }, { key:'unpaid', label:`Unpaid (${bills.filter(b=>!b.isPaid).length})` }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab===t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors self-end sm:self-auto">
            <FiX size={13} /> Clear filters
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-9 text-sm" placeholder="Name or phone" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <input type="date" className="input-field text-sm" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className="input-field text-sm" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          <select className="input-field text-sm" value={filterPaid} onChange={e => setFilterPaid(e.target.value)}>
            <option value="">All payment states</option>
            <option value="true">Paid</option>
            <option value="false">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="card text-center py-16">
          <FiPackage size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No walk-in bills found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(b => (
            <div key={b._id} className={`card transition-all hover:shadow-md ${!b.isPaid ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-emerald-400'}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${b.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    #{b.billNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{b.customerName}</p>
                      <span className="text-xs font-mono text-gray-400">WI-{String(b.billNumber).padStart(4,'0')}</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {b.customerPhone && <span>{b.customerPhone} &bull; </span>}
                      {new Date(b.createdAt).toLocaleString('en-LK', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xl font-display font-bold text-gray-900">LKR {Number(b.totalAmount).toFixed(2)}</span>
                  {b.isPaid
                    ? <span className="badge badge-green flex items-center gap-1">
                        <FiCheck size={11} />Paid · {formatSplits(b.paymentSplits, b.paymentMethod)}
                        {Number(b.changeGiven) > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                            Change LKR {Number(b.changeGiven).toFixed(2)}
                          </span>
                        )}
                      </span>
                    : <span className="badge badge-yellow">Unpaid</span>}
                </div>
              </div>

              {/* Medicine rows */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {b.medicines.map((m, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl px-3 py-2 flex justify-between items-center">
                    <span className="text-sm text-gray-700">{m.name} <span className="text-gray-400">×{m.quantity}</span></span>
                    <span className="text-sm font-semibold text-gray-900">LKR {(m.price * m.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {b.notes && <p className="mt-2 text-xs text-gray-400 italic">{b.notes}</p>}

              {/* Actions */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {!b.isPaid && (
                  <button onClick={() => openPayModal(b)}
                    className="btn-success flex items-center gap-1.5 text-sm py-2 px-4">
                    <FiDollarSign size={14} /> Collect Payment
                  </button>
                )}
                <button onClick={() => handlePrint(b)} className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3">
                  <FiPrinter size={14} /> Print
                </button>
                <button onClick={() => handleDownload(b)} className="btn-secondary flex items-center gap-1.5 text-sm py-2 px-3">
                  <FiDownload size={14} /> Download
                </button>
                <button onClick={() => handleDelete(b._id)} className="py-2 px-3 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-colors flex items-center gap-1.5">
                  <FiTrash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Bill Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <p className="font-display font-bold text-gray-900 text-lg">New Walk-In Bill</p>
                <p className="text-xs text-gray-400 mt-0.5">Direct pharmacy sale — no prescription needed</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-5">
              {/* Customer */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiUser size={12} />Customer Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Customer Name *</label>
                    <input name="customerName" required value={form.customerName} onChange={handleFormChange} className="input-field" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="label-text">Phone</label>
                    <input name="customerPhone" value={form.customerPhone} onChange={handleFormChange} className="input-field" placeholder="Optional" />
                  </div>
                </div>
              </div>

              {/* Medicines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><FiPackage size={12} />Medicines</p>
                  <button type="button" onClick={addRow} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                    <FiPlus size={13} /> Add Row
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 px-1">
                    <span className="col-span-5">Medicine Name</span>
                    <span className="col-span-3">Price (LKR)</span>
                    <span className="col-span-3">Qty</span>
                  </div>
                  {meds.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-5">
                        <CreatableSelect
                          options={medSuggestions.map(n => ({ value: n, label: n }))}
                          value={m.name}
                          onChange={(val, label, isNew) => updateMed(i, 'name', isNew ? label : val)}
                          placeholder="Medicine name…"
                          createLabel="Add"
                        />
                      </div>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={m.price} onChange={e => updateMed(i, 'price', e.target.value)}
                        className="input-field col-span-3 text-sm" />
                      <input type="number" min="1" value={m.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)}
                        className="input-field col-span-3 text-sm" />
                      <button type="button" onClick={() => removeRow(i)} disabled={meds.length === 1}
                        className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 p-1 text-center mt-1">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center bg-emerald-50 rounded-xl px-4 py-3">
                <span className="font-semibold text-gray-700">Total</span>
                <span className="text-2xl font-display font-bold text-emerald-600">LKR {total.toFixed(2)}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="label-text">Notes (optional)</label>
                <textarea name="notes" rows={2} value={form.notes} onChange={handleFormChange}
                  className="input-field resize-none text-sm" placeholder="e.g. customer instructions..." />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</> : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Pay Modal — split-payment aware ── */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <p className="font-display font-bold text-gray-900">Collect Payment</p>
              <button onClick={() => setShowPay(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"><FiX size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-bold text-gray-900 text-lg">{showPay.customerName}</p>
                <p className="text-xs text-gray-400 mt-1">Bill #WI-{String(showPay.billNumber).padStart(4,'0')} &bull; {showPay.medicines.length} item(s)</p>
                <p className="text-3xl font-display font-bold text-emerald-600 mt-2">LKR {Number(showPay.totalAmount).toFixed(2)}</p>
              </div>

              <SplitPaymentInput
                totalDue={Number(showPay.totalAmount)}
                value={paySplits}
                onChange={setPaySplits}
                accent="emerald"
                onChangeGiven={setPayChange}
              />

              <div className="flex gap-3">
                <button onClick={() => setShowPay(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handlePay} disabled={paying}
                  className="btn-success flex-1 flex items-center justify-center gap-2">
                  <FiCheck size={16} />{paying ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
