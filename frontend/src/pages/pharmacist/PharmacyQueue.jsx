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

const buildBillHtml = (appt, bill, logoSrc) => {
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${CLINIC.name}" style="height:64px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : '';
  const rows = bill.medicines.map(m => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0">${m.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:center">${m.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">LKR ${Number(m.price).toFixed(2)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">LKR ${(m.price * m.quantity).toFixed(2)}</td>
    </tr>`).join('');

  // Show payment breakdown if multiple methods were used
  const splits = bill.paymentSplits || [];
  let paymentDetail = '';
  if (bill.isPaid) {
    if (splits.length > 1) {
      paymentDetail = splits.map(s =>
        `<div style="color:#6b7280;text-transform:capitalize">${s.method}: LKR ${Number(s.amount).toFixed(2)}</div>`
      ).join('');
    } else {
      paymentDetail = `<div style="color:#6b7280;margin-top:4px;text-transform:capitalize">${bill.paymentMethod}</div>`;
    }
    // Tendered + change due
    if (Number(bill.changeGiven) > 0) {
      const tendered = Number(bill.totalTendered || bill.cashTendered || 0);
      paymentDetail += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #d1d5db;color:#374151">
        <div>Tendered: <strong>LKR ${tendered.toFixed(2)}</strong></div>
        <div style="color:#047857">Change: <strong>LKR ${Number(bill.changeGiven).toFixed(2)}</strong></div>
      </div>`;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pharmacy Bill #${bill.billNumber}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:24px;color:#1a1a1a;font-size:13px}
    .header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:16px}
    .clinic-name{font-size:22px;font-weight:800;color:#2563eb;margin-bottom:2px}
    .clinic-sub{font-size:12px;color:#4b5563;line-height:1.6}
    .meta{display:flex;justify-content:space-between;margin-bottom:14px;gap:16px}
    .meta-box{flex:1;background:#f8faff;padding:10px 12px;border-radius:8px}
    .meta-label{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:600}
    .meta-value{font-weight:700;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    thead{background:#2563eb;color:#fff}
    thead th{padding:8px;text-align:left;font-size:12px}
    .total-row{background:#f0f4ff;font-weight:800}
    .total-row td{padding:10px 8px;font-size:15px}
    .status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .paid{background:#d1fae5;color:#065f46} .unpaid{background:#fef3c7;color:#92400e}
    .footer{margin-top:20px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:10px}
    @media print{body{padding:10px}}
  </style></head><body>
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div style="font-size:15px;font-weight:700;margin:10px 0 2px">Pharmacy Bill — #${bill.billNumber || 1}</div>
    <div style="font-size:12px;color:#6b7280">${new Date(bill.billedAt).toLocaleString()}</div>
  </div>
  <div class="meta">
    <div class="meta-box"><div class="meta-label">Patient</div><div class="meta-value">${appt.patientName}</div><div style="color:#6b7280">${appt.patientPhone}</div></div>
    <div class="meta-box"><div class="meta-label">Doctor</div><div class="meta-value">Dr. ${appt.doctor?.name || ''}</div><div style="color:#6b7280">${appt.service?.name || ''}</div></div>
    <div class="meta-box"><div class="meta-label">Payment</div>
      <div class="meta-value"><span class="status ${bill.isPaid ? 'paid' : 'unpaid'}">${bill.isPaid ? '✓ Paid' : 'Pending'}</span></div>
      ${paymentDetail}</div>
  </div>
  <table><thead><tr><th>Medicine</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="3" style="padding:10px 8px;text-align:right">Grand Total</td>
      <td style="padding:10px 8px;text-align:right;color:#2563eb">LKR ${Number(bill.totalAmount).toFixed(2)}</td></tr>
      ${bill.isPaid && Number(bill.changeGiven) > 0 ? `
      <tr><td colspan="3" style="padding:6px 8px;text-align:right;color:#374151">Tendered</td>
        <td style="padding:6px 8px;text-align:right;color:#374151">LKR ${Number(bill.totalTendered || bill.cashTendered || 0).toFixed(2)}</td></tr>
      <tr><td colspan="3" style="padding:6px 8px;text-align:right;font-weight:700;color:#047857">Change Returned</td>
        <td style="padding:6px 8px;text-align:right;font-weight:700;color:#047857">LKR ${Number(bill.changeGiven).toFixed(2)}</td></tr>
      ` : ''}
    </tfoot>
  </table>
  <div class="footer">${CLINIC.name} &bull; ${CLINIC.address} &bull; ${CLINIC.phone} &bull; Computer-generated bill</div>
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
    win.document.write(buildBillHtml(appt, bill, logo));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleDownload = async (appt, bill) => {
    const logo = await getLogoBase64();
    const blob = new Blob([buildBillHtml(appt, bill, logo)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pharmacy-bill-${appt.patientName.replace(/\s+/g, '-')}-${bill.billNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Bill downloaded!');
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
      return toast.error(`Tendered total (LKR ${sum.toFixed(2)}) is less than bill (LKR ${Number(selectedBill.totalAmount).toFixed(2)})`);
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
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                <span className="col-span-5">Medicine Name</span>
                <span className="col-span-3">Unit Price (LKR)</span>
                <span className="col-span-3">Quantity</span>
              </div>
              {medicines.map((med, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <CreatableSelect
                      options={medSuggestions.map(n => ({ value: n, label: n }))}
                      value={med.name}
                      onChange={(val, label, isNew) => update(i, 'name', isNew ? label : val)}
                      placeholder="Medicine name…"
                      createLabel="Add"
                    />
                  </div>
                  <input type="number" min="0" step="0.01" placeholder="0.00" value={med.price} onChange={e => update(i, 'price', e.target.value)} className="input-field col-span-3 text-sm" />
                  <input type="number" min="1" value={med.quantity} onChange={e => update(i, 'quantity', e.target.value)} className="input-field col-span-3 text-sm" />
                  <button type="button" onClick={() => removeRow(i)} disabled={medicines.length === 1} className="col-span-1 text-red-400 hover:text-red-600 disabled:opacity-30 text-center p-1 mt-1"><FiTrash2 size={14} /></button>
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
