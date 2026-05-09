import { useState, useEffect } from 'react';
import { pharmacyService, appointmentService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState } from '../../components/common';
import CreatableSelect from '../../components/common/CreatableSelect';
import SplitPaymentInput, { formatSplits } from '../../components/common/SplitPaymentInput';
import toast from 'react-hot-toast';
import {
  FiPackage, FiCalendar, FiPlus, FiTrash2, FiPrinter, FiDownload,
  FiCheck, FiFileText, FiDollarSign,
} from 'react-icons/fi';

const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

/** Fetch logo.png and return a base64 data-URL so it renders in print popups */
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
.clinic-name { font-size: 16pt; font-weight: 700; letter-spacing: .04em;  }
.clinic-sub { font-size: 8.5pt; color: #444; line-height: 1.7; font-family: Arial, sans-serif; }
.bill-label { font-size: 12pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin: 9px 0 2px; font-family: Arial, sans-serif; }
.bill-ref { font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; }
.meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; border-bottom: 1px solid #ccc; padding-bottom: 12px; }
.meta-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; font-family: Arial, sans-serif; margin-bottom: 2px; }
.meta-value { font-size: 10pt; font-weight: 700; font-family: Arial, sans-serif; }
.meta-sub { font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; }
.badge { display: inline-block; padding: 2px 9px; border-radius: 2px; font-size: 8pt; font-weight: 700; font-family: Arial, sans-serif; border: 1.5px solid #000; }
.paid-b { background: #000; color: #fff; }
.unpaid-b { background: #fff; color: #000; }
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

const buildBillHtml = (appt, bill, logoSrc, mode = 'print') => {
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

  const billNo = `PH-${String(bill.billNumber || 1).padStart(4, '0')}`;
  const safeName = (appt.patientName || 'patient').replace(/\s+/g, '-');

  const pdfScript = mode === 'download' ? `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      function generatePDF() {
        var btn = document.getElementById('pdf-btn');
        if (btn) btn.style.display = 'none';
        html2pdf().set({
          margin: 0,
          filename: 'pharmacy-bill-${safeName}-${billNo}.pdf',
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

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pharmacy Bill ${billNo}</title>
  <style>${BILL_STYLES}</style>${pdfScript}</head><body>
<div id="bill-root">
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div class="bill-label">Pharmacy Bill</div>
    <div class="bill-ref">${billNo} &bull; ${new Date(bill.billedAt).toLocaleString()}</div>
  </div>
  <div class="meta">
    <div><div class="meta-label">Patient</div><div class="meta-value">${appt.patientName}</div><div class="meta-sub">${appt.patientPhone || ''}</div></div>
    <div><div class="meta-label">Doctor</div><div class="meta-value">Dr. ${appt.doctor?.name || ''}</div><div class="meta-sub">${appt.service?.name || ''}</div></div>
    <div><div class="meta-label">Payment Status</div><div class="meta-value" style="margin-top:4px"><span class="badge ${bill.isPaid ? 'paid-b' : 'unpaid-b'}">${bill.isPaid ? '✓ Paid' : 'Pending'}</span></div></div>
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
  <div class="footer">${CLINIC.name} &bull; ${CLINIC.address} &bull; Tel: ${CLINIC.phone}<br>Computer-generated bill &bull; No signature required</div>
  ${pdfBtn}
</div>
</body></html>`;
};

export default function PharmacyQueue() {
  const [appointments, setAppointments] = useState([]);
  const [activeDates, setActiveDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [showBill, setShowBill] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [medicines, setMedicines] = useState([{ name: '', price: '', quantity: 1 }]);
  const [medSuggestions, setMedSuggestions] = useState([]);
  const [paySplits, setPaySplits] = useState([]);
  const [payChange, setPayChange] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [tab, setTab] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, d] = await Promise.all([
        pharmacyService.getAppointments({ date: dateFilter }),
        appointmentService.getActiveDates()
      ]);
      setAppointments(r.data);
      setActiveDates(d.data || []);
      // Build medicine name suggestions from prescribed medicines in all appointments
      const nameSet = new Set();
      r.data.forEach(appt => {
        (appt.prescribedMedicines || []).forEach(m => { if (m.name) nameSet.add(m.name); });
        (appt.pharmacyBills || []).forEach(bill =>
          (bill.medicines || []).forEach(m => { if (m.name) nameSet.add(m.name); })
        );
      });
      setMedSuggestions([...nameSet].sort());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [dateFilter]);

  const openBill = (appt) => {
    setSelectedAppt(appt);
    setMedicines([{ name: '', price: '', quantity: 1 }]);
    setShowBill(true);
  };

  const openPay = (appt, bill) => {
    setSelectedAppt(appt);
    setSelectedBill(bill);
    setPaySplits([{ method: 'cash', amount: Number(bill.totalAmount) }]);
    setPayChange(0);
    setShowPay(true);
  };

  const handlePrint = async (appt, bill) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(buildBillHtml(appt, bill, logo, 'print'));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleDownload = async (appt, bill) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(buildBillHtml(appt, bill, logo, 'download'));
    win.document.close();
    toast.success('PDF download starting...');
  };

  const addRow = () => setMedicines([...medicines, { name: '', price: '', quantity: 1 }]);
  const removeRow = (i) => setMedicines(medicines.filter((_, idx) => idx !== i));
  const update = (i, f, v) => setMedicines(medicines.map((m, idx) => idx === i ? { ...m, [f]: v } : m));
  const total = medicines.reduce((s, m) => s + (parseFloat(m.price || 0) * parseInt(m.quantity || 1)), 0);

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    const valid = medicines.filter(m => m.name.trim() && m.price);
    if (!valid.length) return toast.error('Add at least one medicine with price');
    setSaving(true);
    try {
      await pharmacyService.addBill(selectedAppt._id, {
        medicines: valid.map(m => ({ name: m.name, price: parseFloat(m.price), quantity: parseInt(m.quantity) }))
      });
      toast.success('Bill created!');
      setShowBill(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handlePayBill = async () => {
    const sum = paySplits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    if (sum < selectedBill.totalAmount - 0.01) {
      return toast.error(`Paid total (LKR ${sum.toFixed(2)}) is less than bill (LKR ${Number(selectedBill.totalAmount).toFixed(2)})`);
    }
    setPaying(true);
    try {
      await pharmacyService.payBill(selectedAppt._id, {
        billId: selectedBill._id,
        splits: paySplits,
      });
      toast.success(payChange > 0
        ? `Bill #${selectedBill.billNumber} paid — change LKR ${payChange.toFixed(2)}`
        : `Bill #${selectedBill.billNumber} paid ✓`);
      setShowPay(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setPaying(false); }
  };

  const hasUnpaid = (appt) => appt.pharmacyBills?.some(b => !b.isPaid);
  const pendingAppts = appointments.filter(a => !a.pharmacyBills?.length || hasUnpaid(a));
  const allBilledAppts = appointments.filter(a => a.pharmacyBills?.length > 0);
  const sortedAll = [...appointments].sort((a, b) => a.queueNumber - b.queueNumber);
  const display = tab === 'pending' ? pendingAppts : (tab === 'all' ? sortedAll : allBilledAppts);

  return (
    <div>
      <PageHeader title="Pharmacy Queue" subtitle="Create bills, collect payments, print receipts" />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
          <FiCalendar className="text-primary-500" size={18} />
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-semibold text-gray-700"
            title="Select date to filter queue" />
        </div>

        {activeDates.length > 0 && (
          <div className="flex-1 flex flex-wrap items-center gap-2 border-l border-gray-100 pl-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Active Dates</span>
            {activeDates.sort().reverse().slice(0, 5).map(d => (
              <button
                key={d}
                onClick={() => setDateFilter(d)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border
                  ${dateFilter === d
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-200 scale-105'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:bg-primary-50'}`}>
                {new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl ml-auto">
          {[
            { key: 'all', label: `All Patients (${appointments.length})` },
            { key: 'pending', label: `Pending Bill (${pendingAppts.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : display.length === 0
        ? <EmptyState message="No appointments to show" icon={<FiPackage size={40} />} />
        : (
          <div className="space-y-4">
            {display.map(appt => (
              <div key={appt._id} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center font-bold text-primary-700 flex-shrink-0">
                      #{appt.queueNumber}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{appt.patientName}</p>
                      <p className="text-sm text-gray-500">{appt.patientPhone} &bull; Dr. {appt.doctor?.name} &bull; {appt.service?.name}</p>
                    </div>
                  </div>
                  <button onClick={() => openBill(appt)} className="btn-primary flex items-center gap-2 text-sm flex-shrink-0">
                    <FiPlus size={14} />New Bill
                  </button>
                </div>

                {appt.prescription && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs font-semibold text-blue-600 mb-1">PRESCRIPTION</p>
                    <p className="text-sm text-blue-900">{appt.prescription}</p>
                    {appt.prescribedMedicines?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {appt.prescribedMedicines.map((m, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{m.name} × {m.quantity}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {appt.pharmacyBills?.length > 0 && (
                  <div className="space-y-3 mt-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bills ({appt.pharmacyBills.length})</p>
                    {appt.pharmacyBills.map(bill => (
                      <div key={bill._id} className={`rounded-xl border p-3 ${bill.isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">Bill #{bill.billNumber}</span>
                            {bill.isPaid
                              ? <span className="badge badge-green flex items-center gap-1">
                                <FiCheck size={10} />Paid · {formatSplits(bill.paymentSplits, bill.paymentMethod)}
                                {Number(bill.changeGiven) > 0 && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                                    Change LKR {Number(bill.changeGiven).toFixed(2)}
                                  </span>
                                )}
                              </span>
                              : <span className="badge badge-yellow">Unpaid</span>}
                          </div>
                          <span className="font-bold text-primary-600 text-lg">LKR {Number(bill.totalAmount).toFixed(2)}</span>
                        </div>
                        <div className="text-xs text-gray-600 mb-3 space-y-0.5">
                          {bill.medicines?.map((m, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{m.name} × {m.quantity}</span>
                              <span>LKR {(m.price * m.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {!bill.isPaid && (
                            <button onClick={() => openPay(appt, bill)} className="btn-success flex items-center gap-1 text-xs py-1.5 px-3">
                              <FiDollarSign size={13} />Pay Bill
                            </button>
                          )}
                          <button onClick={() => handlePrint(appt, bill)} className="btn-secondary flex items-center gap-1 text-xs py-1.5 px-3">
                            <FiPrinter size={13} />Print
                          </button>
                          <button onClick={() => handleDownload(appt, bill)} className="btn-secondary flex items-center gap-1 text-xs py-1.5 px-3">
                            <FiDownload size={13} />Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }

      {/* Create bill modal */}
      <Modal isOpen={showBill} onClose={() => setShowBill(false)} title={`New Bill — ${selectedAppt?.patientName}`} size="lg">
        <form onSubmit={handleSubmitBill} className="space-y-5">
          {selectedAppt?.prescription && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1"><FiFileText size={12} /> DOCTOR'S PRESCRIPTION</p>
              <p className="text-sm text-blue-900 mb-2">{selectedAppt.prescription}</p>
              {selectedAppt.prescribedMedicines?.length > 0 && (
                <div className="bg-white/60 rounded-lg p-2 space-y-1">
                  {selectedAppt.prescribedMedicines.map((m, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="font-semibold text-blue-800">{m.name}</span>
                      <span className="text-blue-600">Qty: {m.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Medicines</label>
              <button type="button" onClick={addRow} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3"><FiPlus size={13} />Add Row</button>
            </div>
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <span className="col-span-5">Medicine Name</span>
                <span className="col-span-3">Unit Price (LKR)</span>
                <span className="col-span-3">Quantity</span>
              </div>
              {medicines.map((med, i) => (
                <div key={i} className="flex flex-col sm:grid sm:grid-cols-12 gap-2 items-start p-2 sm:p-0 bg-gray-50 sm:bg-transparent rounded-lg sm:rounded-none">
                  <div className="w-full sm:col-span-5">
                    <label className="block sm:hidden text-xs text-gray-500 mb-1">Medicine Name</label>
                    <CreatableSelect
                      options={medSuggestions.map(n => ({ value: n, label: n }))}
                      value={med.name}
                      onChange={(val, label, isNew) => update(i, 'name', isNew ? label : val)}
                      placeholder="Medicine name…"
                      createLabel="Add"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:contents">
                    <div className="flex-1 sm:contents">
                      <label className="block sm:hidden text-xs text-gray-500 mb-1">Unit Price (LKR)</label>
                      <input type="number" min="0" step="0.01" placeholder="0.00" value={med.price} onChange={e => update(i, 'price', e.target.value)} className="input-field sm:col-span-3 text-sm w-full" />
                    </div>
                    <div className="flex-1 sm:contents">
                      <label className="block sm:hidden text-xs text-gray-500 mb-1">Quantity</label>
                      <input type="number" min="1" value={med.quantity} onChange={e => update(i, 'quantity', e.target.value)} className="input-field sm:col-span-3 text-sm w-full" />
                    </div>
                    <button type="button" onClick={() => removeRow(i)} disabled={medicines.length === 1} className="sm:col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 text-center p-1 mt-1 self-end"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center bg-gray-50 rounded-xl px-4 py-3">
            <span className="font-semibold text-gray-700">Total</span>
            <span className="text-2xl font-display font-bold text-primary-600">LKR {total.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowBill(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Creating...' : 'Create Bill'}</button>
          </div>
        </form>
      </Modal>

      {/* Pay bill modal — split-payment aware */}
      <Modal isOpen={showPay} onClose={() => setShowPay(false)} title={`Pay Bill #${selectedBill?.billNumber}`} size="sm">
        {selectedBill && selectedAppt && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Patient</p>
              <p className="font-bold text-gray-900">{selectedAppt.patientName}</p>
              <p className="text-sm text-gray-500 mt-2">Amount Due</p>
              <p className="text-2xl font-display font-bold text-primary-600">LKR {Number(selectedBill.totalAmount).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedBill.medicines?.length} item(s)</p>
            </div>

            <SplitPaymentInput
              totalDue={Number(selectedBill.totalAmount)}
              value={paySplits}
              onChange={setPaySplits}
              accent="primary"
              onChangeGiven={setPayChange}
            />

            <div className="flex gap-3">
              <button onClick={() => setShowPay(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handlePayBill} disabled={paying} className="btn-success flex-1 flex items-center justify-center gap-2">
                <FiCheck size={16} />{paying ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
