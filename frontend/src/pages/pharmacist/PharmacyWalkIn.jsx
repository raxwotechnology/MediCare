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

const BILL_STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; font-size: 11.5pt; }
#bill-root { width: 210mm; min-height: 297mm; padding: 6.35mm; margin: 0 auto; }
.header { text-align: center; border-top: 3px solid #000; border-bottom: 3px solid #000; padding: 12px 0; margin-bottom: 14px; }
.logo { height: 56px; object-fit: contain; display: block; margin: 0 auto 8px; }
.clinic-name { font-size: 16pt; font-weight: 700; letter-spacing: .04em; }
.clinic-sub { font-size: 8.5pt; color: #444; line-height: 1.7; font-family: Arial, sans-serif; }
.bill-label { font-size: 12pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 9px 0 2px; font-family: Arial, sans-serif; }
.bill-ref { font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; }
.meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid #ccc; padding-bottom: 12px; }
.meta-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; font-family: Arial, sans-serif; margin-bottom: 2px; }
.meta-value { font-size: 10pt; font-weight: 700; font-family: Arial, sans-serif; }
.meta-sub { font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; }
.badge { display: inline-block; padding: 2px 9px; border-radius: 2px; font-size: 8pt; font-weight: 700; font-family: Arial, sans-serif; border: 1.5px solid #000; }
.paid-b { background: #000; color: #fff; } .unpaid-b { background: #fff; color: #000; }
.walkin-tag { display: inline-block; border: 1px solid #000; padding: 1px 7px; font-size: 7.5pt; font-family: Arial, sans-serif; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
table.meds { width: 100%; border-collapse: collapse; }
table.meds thead th { background: #000; color: #fff; padding: 6px 9px; text-align: left; font-size: 8.5pt; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: .04em; }
.th-c { text-align: center !important; } .th-r { text-align: right !important; }
table.meds tbody td { padding: 7px 9px; border-bottom: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 10pt; }
.td-c { text-align: center; } .td-r { text-align: right; font-family: 'Courier New', monospace; }
.tfoot-total td { padding: 8px 9px; border-top: 2px solid #000; font-family: Arial, sans-serif; font-size: 10pt; font-weight: 700; text-align: right; }
.tfoot-total .td-mono { font-family: 'Courier New', monospace; font-size: 12pt; }
.tfoot-sub td { padding: 5px 9px; font-family: Arial, sans-serif; font-size: 9.5pt; text-align: right; }
.tfoot-change td { padding: 5px 9px; font-family: Arial, sans-serif; font-size: 9.5pt; font-weight: 700; text-align: right; }
.pay-box { margin-top: 12px; padding: 9px 12px; border: 1.5px solid #ccc; }
.pay-title { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; font-family: Arial, sans-serif; margin-bottom: 5px; }
.pay-tbl { width: 100%; font-size: 9.5pt; font-family: Arial, sans-serif; }
.pm { padding: 3px 7px; } .pa { padding: 3px 7px; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
.notes-box { margin-top: 10px; padding: 8px 12px; border: 1px solid #ddd; font-family: Arial, sans-serif; font-size: 9.5pt; }
.footer { margin-top: 20px; text-align: center; font-size: 7.5pt; color: #777; border-top: 1px solid #ccc; padding-top: 9px; font-family: Arial, sans-serif; line-height: 1.6; }
@media print {
  body { margin: 0; }
  #bill-root { padding: 6.35mm; width: 210mm; min-height: 297mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  table.meds thead th { background: #000 !important; color: #fff !important; }
  .paid-b { background: #000 !important; color: #fff !important; }
  #pdf-btn { display: none !important; }
}
@page { size: A4; margin: 0; }
`;

/* ── Build bill HTML ── */
const buildBillHtml = (bill, logoSrc, mode = 'print') => {
  const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="${CLINIC.name}" class="logo" />` : '';

  const rows = bill.medicines.map(m => `
    <tr>
      <td>${m.name}</td>
      <td class="td-c">${m.quantity}</td>
      <td class="td-r">LKR ${Number(m.price).toFixed(2)}</td>
      <td class="td-r">LKR ${(m.price * m.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const splits = bill.paymentSplits || [];
  let payRows = '';
  if (bill.isPaid) {
    if (splits.length > 1) {
      payRows = splits.map(s =>
        `<tr><td class="pm" style="text-transform:capitalize">${s.method}</td><td class="pa">LKR ${Number(s.amount).toFixed(2)}</td></tr>`
      ).join('');
    } else if (bill.paymentMethod) {
      payRows = `<tr><td class="pm" style="text-transform:capitalize">${bill.paymentMethod}</td><td class="pa">LKR ${Number(bill.totalAmount).toFixed(2)}</td></tr>`;
    }
  }
  const payBlock = payRows ? `<div class="pay-box"><div class="pay-title">Payment Breakdown</div><table class="pay-tbl">${payRows}</table></div>` : '';

  const changeGiven = Number(bill.changeGiven || 0);
  const tendered = Number(bill.totalTendered || bill.cashTendered || 0);
  const changeRows = bill.isPaid && changeGiven > 0 ? `
    <tr class="tfoot-sub"><td colspan="3">Cash Paid</td><td style="font-family:'Courier New',monospace">LKR ${tendered.toFixed(2)}</td></tr>
    <tr class="tfoot-change"><td colspan="3">Change Returned</td><td style="font-family:'Courier New',monospace">LKR ${changeGiven.toFixed(2)}</td></tr>` : '';

  const billNo = `WI-${String(bill.billNumber).padStart(4, '0')}`;
  const safeName = (bill.customerName || 'customer').replace(/\s+/g, '-');

  const pdfScript = mode === 'download' ? `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      function generatePDF() {
        var btn = document.getElementById('pdf-btn');
        if (btn) btn.style.display = 'none';
        html2pdf().set({
          margin: 0,
          filename: 'walkin-bill-${safeName}-${billNo}.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(document.getElementById('bill-root')).save().then(function(){
          if (btn) btn.style.display = '';
        });
      }
      window.addEventListener('load', function(){ setTimeout(generatePDF, 700); });
    <\/script>` : '';

  const pdfBtn = mode === 'download'
    ? `<div style="text-align:center;margin:16px 0 4px"><button id="pdf-btn" onclick="generatePDF()" style="background:#000;color:#fff;border:none;padding:10px 28px;font-size:13px;font-weight:700;letter-spacing:.05em;border-radius:3px;cursor:pointer;font-family:Arial,sans-serif;">⬇ Download PDF</button></div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Walk-In Bill ${billNo}</title>
  <style>${BILL_STYLES}</style>${pdfScript}</head><body>
<div id="bill-root">
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div class="bill-label">Walk-In Pharmacy Bill</div>
    <div class="bill-ref">${billNo} &bull; ${new Date(bill.createdAt).toLocaleString()}</div>
  </div>
  <div class="meta">
    <div>
      <div class="meta-label">Customer</div>
      <div class="meta-value">${bill.customerName}</div>
      ${bill.customerPhone ? `<div class="meta-sub">${bill.customerPhone}</div>` : ''}
    </div>
    <div>
      <div class="meta-label">Payment Status</div>
      <div class="meta-value" style="margin-top:4px"><span class="badge ${bill.isPaid ? 'paid-b' : 'unpaid-b'}">${bill.isPaid ? '✓ Paid' : 'Pending'}</span></div>
    </div>
  </div>
  <table class="meds">
    <thead><tr><th>Medicine / Item</th><th class="th-c">Qty</th><th class="th-r">Unit Price</th><th class="th-r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="tfoot-total"><td colspan="3">Grand Total</td><td class="td-mono">LKR ${Number(bill.totalAmount).toFixed(2)}</td></tr>
      ${changeRows}
    </tfoot>
  </table>
  ${payBlock}
  ${bill.notes ? `<div class="notes-box"><strong>Notes:</strong> ${bill.notes}</div>` : ''}
  <div class="footer">${CLINIC.name} &bull; Walk-In Pharmacy &bull; No Prescription Required<br>Computer-generated bill &bull; No signature required</div>
  ${pdfBtn}
</div>
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
const EMPTY_MED = { name: '', price: '', quantity: 1 };

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
      return toast.error(`Paid total (LKR ${sum.toFixed(2)}) is less than bill (LKR ${Number(showPay.totalAmount).toFixed(2)})`);
    }
    setPaying(true);
    try {
      await walkInBillService.pay(showPay._id, {
        splits: paySplits,
      });
      toast.success(payChange > 0
        ? `Bill #WI-${String(showPay.billNumber).padStart(4, '0')} paid — change LKR ${payChange.toFixed(2)}`
        : `Bill #WI-${String(showPay.billNumber).padStart(4, '0')} paid ✓`);
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
    win.document.write(buildBillHtml(b, logo, 'print'));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const handleDownload = async (b) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(buildBillHtml(b, logo, 'download'));
    win.document.close();
    toast.success('PDF download starting...');
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
          <SCard icon={FiDollarSign} label="Revenue" value={`LKR ${Number(summary.totalRevenue || 0).toLocaleString()}`} color="border-teal-500 text-teal-600" />
          <SCard icon={FiCheck} label="Paid" value={summary.paid} color="border-primary-500 text-primary-600" />
          <SCard icon={FiBarChart2} label="Pending" value={summary.pending} color="border-amber-500 text-amber-600" />
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {[{ key: 'all', label: `All (${bills.length})` }, { key: 'unpaid', label: `Unpaid (${bills.filter(b => !b.isPaid).length})` }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
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
                      <span className="text-xs font-mono text-gray-400">WI-{String(b.billNumber).padStart(4, '0')}</span>
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
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-400 px-1">
                    <span className="col-span-5">Medicine Name</span>
                    <span className="col-span-3">Price (LKR)</span>
                    <span className="col-span-3">Qty</span>
                  </div>
                  {meds.map((m, i) => (
                    <div key={i} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-start p-2 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none">
                      <div className="w-full sm:col-span-5">
                        <label className="block sm:hidden text-xs text-gray-500 mb-1">Medicine Name</label>
                        <CreatableSelect
                          options={medSuggestions.map(n => ({ value: n, label: n }))}
                          value={m.name}
                          onChange={(val, label, isNew) => updateMed(i, 'name', isNew ? label : val)}
                          placeholder="Medicine name…"
                          createLabel="Add"
                        />
                      </div>
                      <div className="flex gap-2 w-full sm:contents">
                        <div className="flex-1 sm:contents">
                          <label className="block sm:hidden text-xs text-gray-500 mb-1">Price (LKR)</label>
                          <input type="number" min="0" step="0.01" placeholder="0.00" value={m.price} onChange={e => updateMed(i, 'price', e.target.value)}
                            className="input-field sm:col-span-3 text-sm w-full" />
                        </div>
                        <div className="flex-1 sm:contents">
                          <label className="block sm:hidden text-xs text-gray-500 mb-1">Qty</label>
                          <input type="number" min="1" value={m.quantity} onChange={e => updateMed(i, 'quantity', e.target.value)}
                            className="input-field sm:col-span-3 text-sm w-full" />
                        </div>
                        <button type="button" onClick={() => removeRow(i)} disabled={meds.length === 1}
                          className="sm:col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 p-1 text-center mt-1 self-end">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
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
                <p className="text-xs text-gray-400 mt-1">Bill #WI-{String(showPay.billNumber).padStart(4, '0')} &bull; {showPay.medicines.length} item(s)</p>
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
