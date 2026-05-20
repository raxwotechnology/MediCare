import { useState, useEffect } from 'react';
import { appointmentService, doctorService } from '../../services';
import { PageHeader, Spinner, EmptyState, Modal } from '../../components/common';
import SplitPaymentInput, { formatSplits } from '../../components/common/SplitPaymentInput';
import DatePickerWithHighlights from '../../components/common/DatePickerWithHighlights';
import { printAppointmentInvoice, downloadAppointmentInvoice } from '../../utils/appointmentInvoice';
import toast from 'react-hot-toast';
import {
  FiCalendar, FiCheck, FiSearch, FiPlus, FiTrash2,
  FiPrinter, FiDownload, FiFileText, FiClock, FiXCircle,
} from 'react-icons/fi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotsForDate(doctor, dateStr) {
  if (!doctor?.availability?.length) return [];
  const dayName = DAYS[new Date(dateStr + 'T00:00:00').getDay()];
  return doctor.availability.filter(s => s.day === dayName);
}

function computeSuggestedTime(doctor, dateStr, queueNumber) {
  const slots = getSlotsForDate(doctor, dateStr);
  if (!slots.length || !queueNumber) return null;
  const earliest = slots.reduce((a, b) => (a.startTime < b.startTime ? a : b));
  const [h, m] = earliest.startTime.split(':').map(Number);
  const base = new Date(dateStr + 'T00:00:00');
  base.setHours(h, m + (queueNumber - 1) * 15, 0, 0);
  return base.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ReceptionistAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [allDoctors, setAllDoctors] = useState([]);
  const [processing, setProcessing] = useState(null);

  // — Reception payment modal —
  const [payModal, setPayModal] = useState(false);
  const [payingAppt, setPayingAppt] = useState(null);
  const [paySplits, setPaySplits] = useState([]);
  const [payChange, setPayChange] = useState(0);

  // — Add extra service modal —
  const [extraModal, setExtraModal] = useState(false);
  const [extraAppt, setExtraAppt] = useState(null);
  const [extraDoctor, setExtraDoctor] = useState(null);
  const [extraForm, setExtraForm] = useState({ serviceId: '', serviceName: '', price: '', doctorFee: '', description: '' });
  const [savingExtra, setSavingExtra] = useState(false);

  // — Pay extra charge modal —
  const [payExtraModal, setPayExtraModal] = useState(false);
  const [payingExtra, setPayingExtra] = useState({ appt: null, charge: null });
  const [extraSplits, setExtraSplits] = useState([]);
  const [extraChange, setExtraChange] = useState(0);

  // — Refund / cancel-with-refund modal —
  const [refundModal, setRefundModal] = useState(false);
  const [refundAppt, setRefundAppt] = useState(null);
  const [refundForm, setRefundForm] = useState({ reason: 'Doctor absent', refundMethod: 'cash', refundNotes: '' });
  const [processingRefund, setProcessingRefund] = useState(false);

  // Dates that already have appointments — used to highlight in the picker
  const [activeDates, setActiveDates] = useState([]);
  const refreshActiveDates = () => {
    appointmentService.getActiveDates({ excludeCancelled: 1 })
      .then(r => setActiveDates(r.data || []))
      .catch(() => {});
  };
  useEffect(() => {
    refreshActiveDates();
    doctorService.getAll().then(r => setAllDoctors(r.data || [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await appointmentService.getAll({ date: dateFilter });
      setAppointments(r.data);
      // Refresh the calendar highlights too — list could've grown/shrunk
      refreshActiveDates();
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [dateFilter]);

  /* ── Reception payment ─────────────────────────────────────────────────── */
  const openPayModal = (appt) => {
    setPayingAppt(appt);
    setPaySplits([{ method: 'cash', amount: Number(appt.price) }]);
    setPayChange(0);
    setPayModal(true);
  };

  const handleMarkPaid = async () => {
    const total = paySplits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    if (total < payingAppt.price - 0.01) {
      return toast.error(`Tendered total (LKR ${total.toFixed(2)}) is less than bill (LKR ${Number(payingAppt.price).toFixed(2)})`);
    }
    setProcessing(payingAppt._id);
    try {
      await appointmentService.markPaid(payingAppt._id, { splits: paySplits });
      toast.success(payChange > 0
        ? `Payment recorded — change LKR ${payChange.toFixed(2)}`
        : 'Payment recorded ✓');
      setPayModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setProcessing(null); }
  };

  /* ── Add extra service to an existing appointment ──────────────────────── */
  const openExtraModal = async (appt) => {
    setExtraAppt(appt);
    setExtraForm({ serviceId: '', serviceName: '', price: '', doctorFee: '', description: '' });
    setExtraDoctor(null);
    setExtraModal(true);
    // Fetch doctor's service list so receptionist must pick from it
    try {
      const r = await doctorService.getById(appt.doctor?._id || appt.doctor);
      setExtraDoctor(r.data);
    } catch { /* stays null */ }
  };

  const handleAddExtra = async (e) => {
    e.preventDefault();
    if (!extraForm.serviceName.trim()) return toast.error('Please select a service');
    if (!extraForm.price || Number(extraForm.price) <= 0) return toast.error('Price must be greater than zero');

    setSavingExtra(true);
    try {
      await appointmentService.addExtraCharge(extraAppt._id, {
        serviceId:   extraForm.serviceId || null,
        serviceName: extraForm.serviceName.trim(),
        price:       Number(extraForm.price),
        doctorFee:   Number(extraForm.doctorFee || 0),
        description: extraForm.description.trim(),
      });
      toast.success('Extra service added');
      setExtraModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSavingExtra(false); }
  };

  // When picking from the doctor's service list, autofill name + price + doctorFee
  const pickDoctorService = (svcEntry) => {
    setExtraForm(f => ({
      ...f,
      serviceId:   svcEntry.service?._id || '',
      serviceName: svcEntry.service?.name || '',
      price:       String(svcEntry.price || ''),
      doctorFee:   String(svcEntry.doctorFee !== undefined ? svcEntry.doctorFee : ''),
    }));
  };

  const removeExtra = async (appt, charge) => {
    if (!window.confirm(`Remove "${charge.serviceName}"?`)) return;
    try {
      await appointmentService.deleteExtraCharge(appt._id, charge._id);
      toast.success('Removed');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot remove');
    }
  };

  /* ── Pay extra charge ──────────────────────────────────────────────────── */
  const openPayExtra = (appt, charge) => {
    setPayingExtra({ appt, charge });
    setExtraSplits([{ method: 'cash', amount: Number(charge.price) }]);
    setExtraChange(0);
    setPayExtraModal(true);
  };

  const handlePayExtra = async () => {
    const { appt, charge } = payingExtra;
    const total = extraSplits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
    if (total < charge.price - 0.01) {
      return toast.error(`Tendered total (LKR ${total.toFixed(2)}) is less than bill (LKR ${Number(charge.price).toFixed(2)})`);
    }
    setProcessing(charge._id);
    try {
      await appointmentService.payExtraCharge(appt._id, {
        chargeId: charge._id,
        splits: extraSplits,
      });
      toast.success(extraChange > 0
        ? `Extra paid — change LKR ${extraChange.toFixed(2)}`
        : 'Extra charge paid ✓');
      setPayExtraModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    } finally { setProcessing(null); }
  };

  /* ── Cancel pending appointment (no-show) ─────────────────────────────── */
  const handleCancelAppointment = async (appt) => {
    if (!window.confirm(`Cancel the appointment for ${appt.patientName}?\nThis marks it as cancelled (no payment taken).`)) return;
    setProcessing(appt._id);
    try {
      await appointmentService.cancel(appt._id);
      toast.success('Appointment cancelled');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error cancelling appointment');
    } finally { setProcessing(null); }
  };

  /* ── Invoice print / download ──────────────────────────────────────────── */
  const handlePrintInvoice = async (appt) => {
    // Re-fetch to ensure the printed copy includes any populated extras
    try {
      const r = await appointmentService.getById(appt._id);
      const ok = await printAppointmentInvoice(r.data);
      if (ok) {
        appointmentService.recordInvoicePrint(appt._id).catch(() => {});
      }
    } catch {
      await printAppointmentInvoice(appt);
    }
  };

  const handleDownloadInvoice = async (appt) => {
    try {
      const r = await appointmentService.getById(appt._id);
      await downloadAppointmentInvoice(r.data);
    } catch {
      await downloadAppointmentInvoice(appt);
    }
    toast.success('Invoice downloaded');
  };

  /* ── Cancel paid appointment + issue refund ────────────────────────────── */
  const openRefundModal = (appt) => {
    setRefundAppt(appt);
    setRefundForm({ reason: 'Doctor absent', refundMethod: 'cash', refundNotes: '' });
    setRefundModal(true);
  };

  const refundTotal = (appt) => {
    if (!appt) return 0;
    const reception = Number(appt.receptionPayment?.totalPaid || appt.price || 0);
    const extras = (appt.extraCharges || []).filter(c => c.isPaid).reduce((s, c) => s + Number(c.price || 0), 0);
    return reception + extras;
  };

  const handleCancelWithRefund = async () => {
    if (!refundForm.reason.trim()) return toast.error('Please enter a reason');
    setProcessingRefund(true);
    try {
      const r = await appointmentService.cancelWithRefund(refundAppt._id, refundForm);
      toast.success(`Appointment cancelled — Refund LKR ${refundTotal(refundAppt).toFixed(2)} issued`);
      setRefundModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally { setProcessingRefund(false); }
  };

  const printRefundReceipt = (appt) => {
    const ref = appt.cancellation?.refund;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Refund Receipt</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      @page { size: A5; margin: 8mm; }
      body { font-family: 'Courier New', monospace; font-size: 11pt; color: #000; background: #fff; }
      .wrap { width: 148mm; padding: 8mm; margin: 0 auto; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .big { font-size: 15pt; font-weight: bold; }
      .xl { font-size: 20pt; font-weight: 900; }
      hr { border: none; border-top: 2px dashed #000; margin: 10px 0; }
      .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10.5pt; }
      .label { color: #555; }
      .stamp { border: 3px solid #000; border-radius: 6px; padding: 8px 14px; display: inline-block; margin: 10px auto; }
      .alert { background: #f0f0f0; border: 1.5px solid #000; border-radius: 4px; padding: 10px; margin: 10px 0; text-align: center; }
      @media print { body { margin: 0; } }
    </style></head><body>
    <div class="wrap">
      <div class="center">
        <div class="big">Aayu Medi Care 24</div>
        <div style="font-size:9.5pt;margin-top:2px;font-family:Arial,sans-serif">Pannala Road, Dankotuwa &bull; 0312260097</div>
        <hr/>
        <div class="xl" style="letter-spacing:.08em">REFUND RECEIPT</div>
        <div style="font-size:9pt;margin-top:3px;font-family:Arial,sans-serif">${ref?.receiptNumber || ''}</div>
      </div>
      <hr/>
      <div class="row"><span class="label">Patient</span><span class="bold">${appt.patientName || ''}</span></div>
      <div class="row"><span class="label">Phone</span><span>${appt.patientPhone || ''}</span></div>
      <div class="row"><span class="label">Original Invoice</span><span>${appt.invoiceNumber || ''}</span></div>
      <div class="row"><span class="label">Appointment Date</span><span>${appt.appointmentDate || ''}</span></div>
      <div class="row"><span class="label">Doctor</span><span>${appt.doctor?.designation || 'Dr.'} ${appt.doctor?.name || appt.doctorName || ''}</span></div>
      <div class="row"><span class="label">Service</span><span>${appt.serviceName || ''}</span></div>
      <hr/>
      <div class="alert">
        <div style="font-size:9pt;font-family:Arial,sans-serif;margin-bottom:4px">REASON FOR CANCELLATION</div>
        <div class="bold">${appt.cancellation?.reason || 'Doctor absent'}</div>
      </div>
      <hr/>
      <div class="row"><span class="label">Refund Method</span><span class="bold" style="text-transform:uppercase">${ref?.method || ''}</span></div>
      <div class="row"><span class="label">Refund Amount</span><span class="bold" style="font-size:14pt">LKR ${Number(ref?.amount || 0).toFixed(2)}</span></div>
      <div class="row"><span class="label">Processed At</span><span>${ref?.processedAt ? new Date(ref.processedAt).toLocaleString() : ''}</span></div>
      ${ref?.notes ? `<div class="row"><span class="label">Notes</span><span>${ref.notes}</span></div>` : ''}
      <hr/>
      <div class="center" style="margin-top:8px">
        <div class="stamp bold">REFUND PROCESSED</div>
        <div style="font-size:8.5pt;font-family:Arial,sans-serif;margin-top:8px;color:#555">
          Please keep this receipt as proof of refund.<br/>
          Computer-generated &bull; No signature required
        </div>
      </div>
    </div>
    <script>window.addEventListener('load', () => setTimeout(() => window.print(), 400));<\/script>
    </body></html>`;
    const win = window.open('', '_blank', 'width=620,height=800');
    if (win) { win.document.write(html); win.document.close(); }
  };

  /* ── Filtering / sorting ───────────────────────────────────────────────── */
  const filtered = appointments.filter(a => {
    const matchesSearch = a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      a.patientPhone?.includes(search);
    const matchesDoctor = doctorFilter === 'all' ||
      (a.doctor?._id || a.doctor) === doctorFilter;
    return matchesSearch && matchesDoctor;
  });

  const statusOrder = { pending: 0, paid: 1, with_doctor: 2, completed: 3, cancelled: 4 };
  const sorted = [...filtered].sort((a, b) =>
    statusOrder[a.status] - statusOrder[b.status] || a.queueNumber - b.queueNumber
  );

  const statusLabel = (status) => ({
    pending: 'Awaiting Payment',
    paid: 'Paid — Waiting for Doctor',
    with_doctor: '🩺 With Doctor',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status] || status);

  const statusBorderColor = {
    pending: 'border-amber-400',
    paid: 'border-blue-400',
    with_doctor: 'border-teal-500',
    completed: 'border-emerald-400',
    cancelled: 'border-gray-300',
  };

  const statusBadge = {
    pending: 'badge-yellow',
    paid: 'badge-blue',
    with_doctor: 'bg-teal-100 text-teal-800',
    completed: 'badge-green',
    cancelled: 'badge-gray',
  };

  const canAddExtra = (s) => ['paid', 'with_doctor', 'completed'].includes(s);

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Process patient payments and monitor the queue" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="w-full sm:w-64">
          <DatePickerWithHighlights
            value={dateFilter}
            onChange={(iso) => setDateFilter(iso || new Date().toISOString().split('T')[0])}
            highlightedDates={activeDates}
            accent="primary"
            legend="Has appointments"
          />
        </div>
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input placeholder="Search by patient name or phone..."
            value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select
          value={doctorFilter}
          onChange={e => setDoctorFilter(e.target.value)}
          className="input-field sm:w-52 flex-shrink-0"
        >
          <option value="all">All Doctors</option>
          {allDoctors.map(doc => (
            <option key={doc._id} value={doc._id}>{ doc.designation || 'Dr.'} {doc.name}</option>
          ))}
        </select>
      </div>

      {/* Live status summary */}
      <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
        {[
          { label: 'Awaiting Payment', count: appointments.filter(a => a.status === 'pending').length, color: 'bg-amber-100 text-amber-700' },
          { label: 'With Doctor',      count: appointments.filter(a => a.status === 'with_doctor').length, color: 'bg-teal-100 text-teal-700' },
          { label: 'Completed',        count: appointments.filter(a => a.status === 'completed').length, color: 'bg-emerald-100 text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${s.color} whitespace-nowrap`}>
            {s.label}: <strong>{s.count}</strong>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : sorted.length === 0
        ? <EmptyState message="No appointments for this date" icon={<FiCalendar size={40} />} />
        : (
          <div className="space-y-3">
            {sorted.map(appt => {
              const extras = appt.extraCharges || [];
              const extrasTotal = extras.reduce((s, c) => s + Number(c.price || 0), 0);
              const grandTotal = Number(appt.price || 0) + extrasTotal;
              const apptDoctor = allDoctors.find(d => d._id === (appt.doctor?._id || appt.doctor));
              const suggestedTime = apptDoctor
                ? computeSuggestedTime(apptDoctor, appt.appointmentDate?.split('T')[0] || dateFilter, appt.queueNumber)
                : null;
              return (
                <div key={appt._id} className={`card border-l-4 ${statusBorderColor[appt.status] || 'border-gray-300'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                      {/* Queue badge */}
                      <div className={`w-11 h-11 rounded-full flex flex-col items-center justify-center font-bold text-sm flex-shrink-0 border-2
                        ${appt.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : appt.status === 'with_doctor' ? 'bg-teal-50 text-teal-700 border-teal-300'
                        : appt.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        <span className="text-[9px] font-semibold leading-none opacity-60">Q</span>
                        <span className="leading-tight">#{appt.queueNumber}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{appt.patientName}</p>
                        <p className="text-sm text-gray-500">{appt.patientPhone}</p>
                        {/* Doctor & Service */}
                        <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1 flex-wrap">
                          <span className="font-medium text-primary-700">{appt.doctor?.designation || appt.doctorDesignation || 'Dr.'} {appt.doctor?.name || appt.doctorName || 'Deleted'}</span>
                          <span className="text-gray-400">·</span>
                          <span>{appt.service?.name || appt.serviceName || 'Service'}</span>
                        </p>
                        {/* Suggested arrival time */}
                        {suggestedTime && (
                          <p className="text-xs text-teal-600 mt-1 flex items-center gap-1 font-medium">
                            <FiClock size={11} />
                            Suggested arrival: <strong>{suggestedTime}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-primary-600 text-lg">LKR {grandTotal.toFixed(2)}</p>
                        {extrasTotal > 0 && (
                          <p className="text-xs text-gray-500">
                            ({Number(appt.price).toFixed(2)} + {extrasTotal.toFixed(2)} extras)
                          </p>
                        )}
                        <span className={`badge ${statusBadge[appt.status] || 'badge-gray'}`}>
                          {statusLabel(appt.status)}
                        </span>
                      </div>

                      {appt.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => openPayModal(appt)} disabled={processing === appt._id}
                            className="btn-success flex items-center gap-2 whitespace-nowrap">
                            <FiCheck size={15} />Collect Payment
                          </button>
                          <button
                            onClick={() => handleCancelAppointment(appt)}
                            disabled={processing === appt._id}
                            title="Cancel appointment (no-show)"
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors whitespace-nowrap">
                            <FiXCircle size={14} /> Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action toolbar — extras + invoice — visible after payment */}
                  {canAddExtra(appt.status) && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => openExtraModal(appt)}
                        className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiPlus size={12} /> Add Service
                      </button>
                      <button onClick={() => handlePrintInvoice(appt)}
                        className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiPrinter size={12} /> Print Invoice
                      </button>
                      <button onClick={() => handleDownloadInvoice(appt)}
                        className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-3">
                        <FiDownload size={12} /> Download Invoice
                      </button>
                      {['paid', 'with_doctor'].includes(appt.status) && (
                        <button onClick={() => openRefundModal(appt)}
                          className="text-xs flex items-center gap-1 py-1.5 px-3 font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors whitespace-nowrap">
                          <FiXCircle size={12} /> Cancel &amp; Refund
                        </button>
                      )}
                    </div>
                  )}

                  {/* Reception payment line */}
                  {appt.receptionPayment?.paidAt && (
                    <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                      <FiCheck size={12} className="text-emerald-500" />
                      Paid — {formatSplits(appt.receptionPayment.splits, appt.receptionPayment.paymentMethod)}
                      {Number(appt.receptionPayment?.changeGiven) > 0 && (
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                          Tendered LKR {Number(appt.receptionPayment.totalTendered || appt.receptionPayment.cashTendered).toFixed(2)} · Change LKR {Number(appt.receptionPayment.changeGiven).toFixed(2)}
                        </span>
                      )}
                      <span className="text-gray-400 ml-1">at {new Date(appt.receptionPayment.paidAt).toLocaleTimeString()}</span>
                    </p>
                  )}

                  {/* Extra charges list */}
                  {extras.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                        <FiFileText size={12} /> Extra Services ({extras.length})
                      </p>
                      {extras.map(c => (
                        <div key={c._id}
                          className={`rounded-lg border p-2.5 flex items-center justify-between gap-3 flex-wrap
                            ${c.isPaid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 text-sm">{c.serviceName}</p>
                            {c.description && <p className="text-xs text-gray-500">{c.description}</p>}
                            {c.isPaid && c.paidAt && (
                              <p className="text-xs text-emerald-700 mt-0.5">
                                ✓ {formatSplits(c.paymentSplits, c.paymentMethod)}
                                {Number(c.changeGiven) > 0 && (
                                  <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px] ml-2">
                                    Change LKR {Number(c.changeGiven).toFixed(2)}
                                  </span>
                                )}
                                <span className="text-gray-500 ml-2">{new Date(c.paidAt).toLocaleTimeString()}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary-600">LKR {Number(c.price).toFixed(2)}</span>
                            {!c.isPaid && (
                              <>
                                <button onClick={() => openPayExtra(appt, c)}
                                  className="btn-success text-xs py-1 px-2.5 flex items-center gap-1">
                                  <FiCheck size={11} /> Pay
                                </button>
                                <button onClick={() => removeExtra(appt, c)}
                                  className="text-red-400 hover:text-red-600 p-1">
                                  <FiTrash2 size={13} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {appt.status === 'with_doctor' && appt.doctorQueue?.acceptedAt && (
                    <p className="text-xs text-teal-600 mt-2 pt-2 border-t border-gray-100">
                      🩺 Patient entered doctor's room at {new Date(appt.doctorQueue.acceptedAt).toLocaleTimeString()}
                    </p>
                  )}

                  {appt.status === 'cancelled' && appt.cancellation?.refund?.amount > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 flex-wrap text-xs">
                      <span className="bg-red-100 text-red-700 font-bold px-2 py-1 rounded-md">CANCELLED &amp; REFUNDED</span>
                      <span className="text-gray-600">
                        LKR {Number(appt.cancellation.refund.amount).toFixed(2)} via <strong className="uppercase">{appt.cancellation.refund.method}</strong>
                      </span>
                      <span className="text-gray-400">· {appt.cancellation.reason}</span>
                      <button
                        onClick={() => printRefundReceipt(appt)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium ml-auto">
                        <FiPrinter size={11} /> Reprint Receipt
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      }

      {/* ── Reception payment modal ─────────────────────────────────────── */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Collect Payment" size="sm">
        {payingAppt && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Patient</p>
              <p className="font-bold text-gray-900">{payingAppt.patientName}</p>
              <p className="text-sm text-gray-500 mt-2">Amount Due</p>
              <p className="text-2xl font-display font-bold text-primary-600">LKR {Number(payingAppt.price).toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {payingAppt.service?.name || payingAppt.serviceName || 'Service'} • {(payingAppt.doctor?.designation || payingAppt.doctorDesignation || 'Dr.')} {payingAppt.doctor?.name || payingAppt.doctorName || 'Deleted'}
              </p>
            </div>

            <SplitPaymentInput
              totalDue={Number(payingAppt.price)}
              value={paySplits}
              onChange={setPaySplits}
              accent="primary"
              onChangeGiven={setPayChange}
            />

            <div className="flex gap-3">
              <button onClick={() => setPayModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleMarkPaid} disabled={processing === payingAppt._id}
                className="btn-success flex-1 flex items-center justify-center gap-2">
                <FiCheck size={16} />
                {processing === payingAppt._id ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add extra service modal ─────────────────────────────────────── */}
      <Modal isOpen={extraModal} onClose={() => setExtraModal(false)} title="Add Extra Service" size="md">
        {extraAppt && (
          <form onSubmit={handleAddExtra} className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <span className="text-gray-500">For: </span>
              <span className="font-bold text-gray-900">{extraAppt.patientName}</span>
              <span className="text-gray-500"> • {extraAppt.doctor?.designation || extraAppt.doctorDesignation || 'Dr.'} {extraAppt.doctor?.name || extraAppt.doctorName}</span>
            </div>

            {/* Service picker — doctor's assigned services only */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
                Select Service (Doctor&apos;s Assigned Services) *
              </label>
              {extraDoctor === null ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin" />
                  Loading doctor&apos;s services…
                </div>
              ) : extraDoctor?.services?.length > 0 ? (
                <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                  {extraDoctor.services.map(s => {
                    const selected = extraForm.serviceId === (s.service?._id || '');
                    return (
                      <button key={s._id || s.service?._id} type="button"
                        onClick={() => pickDoctorService(s)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all
                          ${selected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}>
                        <div>
                          <p className={`font-semibold text-sm ${selected ? 'text-primary-700' : 'text-gray-800'}`}>
                            {s.service?.name || 'Service'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {!['paid', 'with_doctor', 'completed'].includes(extraAppt?.status) && (
                              <>Doctor fee: LKR {s.doctorFee !== undefined ? s.doctorFee : '—'}</>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${selected ? 'text-primary-700' : 'text-gray-700'}`}>
                            LKR {s.price}
                          </p>
                          {selected && (
                            <span className="text-xs text-primary-500 font-medium">Selected ✓</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  No services assigned to this doctor yet. Please assign services in Manage Doctors first.
                </div>
              )}
            </div>

            {/* Price & doctor fee — auto-filled but editable (hidden for paid appointments) */}
            {extraForm.serviceName && !['paid', 'with_doctor', 'completed'].includes(extraAppt?.status) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Patient Price (LKR) *</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={extraForm.price}
                    onChange={e => setExtraForm(f => ({ ...f, price: e.target.value }))} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Doctor Fee (LKR)</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={extraForm.doctorFee}
                    onChange={e => setExtraForm(f => ({ ...f, doctorFee: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Notes (optional)</label>
                  <input className="input-field" value={extraForm.description}
                    onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Any extra detail..." />
                </div>
              </div>
            )}
            {extraForm.serviceName && ['paid', 'with_doctor', 'completed'].includes(extraAppt?.status) && (
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Notes (optional)</label>
                <input className="input-field" value={extraForm.description}
                  onChange={e => setExtraForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Any extra detail..." />
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
              The customer can pay for this extra service immediately or later — it will appear as a separate line on the invoice.
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setExtraModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={savingExtra || !extraForm.serviceName} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <FiPlus size={16} />{savingExtra ? 'Adding...' : 'Add Service'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Pay extra charge modal ───────────────────────────────────────── */}
      <Modal isOpen={payExtraModal} onClose={() => setPayExtraModal(false)} title="Pay Extra Service" size="sm">
        {payingExtra.charge && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500">Service</p>
              <p className="font-bold text-gray-900">{payingExtra.charge.serviceName}</p>
              <p className="text-sm text-gray-500 mt-2">Amount Due</p>
              <p className="text-2xl font-display font-bold text-primary-600">
                LKR {Number(payingExtra.charge.price).toFixed(2)}
              </p>
            </div>

            <SplitPaymentInput
              totalDue={Number(payingExtra.charge.price)}
              value={extraSplits}
              onChange={setExtraSplits}
              accent="primary"
              onChangeGiven={setExtraChange}
            />

            <div className="flex gap-3">
              <button onClick={() => setPayExtraModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handlePayExtra} disabled={processing === payingExtra.charge._id}
                className="btn-success flex-1 flex items-center justify-center gap-2">
                <FiCheck size={16} />
                {processing === payingExtra.charge._id ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </Modal>
      {/* ── Cancel & Refund modal ───────────────────────────────────────── */}
      <Modal isOpen={refundModal} onClose={() => setRefundModal(false)} title="Cancel Appointment & Issue Refund" size="sm">
        {refundAppt && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Appointment to Cancel</p>
              <p className="font-bold text-gray-900">{refundAppt.patientName}</p>
              <p className="text-sm text-gray-500">{refundAppt.patientPhone}</p>
              <p className="text-sm text-gray-600 mt-1">
                {refundAppt.doctor?.designation || refundAppt.doctorDesignation || 'Dr.'}{' '}
                {refundAppt.doctor?.name || refundAppt.doctorName} &bull; {refundAppt.serviceName}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Refund Amount</span>
                <span className="text-xl font-bold text-red-600">LKR {refundTotal(refundAppt).toFixed(2)}</span>
              </div>
              {(refundAppt.extraCharges || []).filter(c => c.isPaid).length > 0 && (
                <p className="text-xs text-gray-400 text-right mt-0.5">
                  (consultation + {(refundAppt.extraCharges || []).filter(c => c.isPaid).length} paid extra service{(refundAppt.extraCharges || []).filter(c => c.isPaid).length > 1 ? 's' : ''})
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Reason for Cancellation *</label>
              <select className="input-field" value={refundForm.reason}
                onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))}>
                <option value="Doctor absent">Doctor absent</option>
                <option value="Doctor emergency">Doctor emergency</option>
                <option value="Clinic closed">Clinic closed</option>
                <option value="Patient request">Patient request</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Refund method */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">Refund Method *</label>
              <div className="grid grid-cols-3 gap-2">
                {['cash', 'card', 'online'].map(m => (
                  <button key={m} type="button"
                    onClick={() => setRefundForm(f => ({ ...f, refundMethod: m }))}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold capitalize transition-all
                      ${refundForm.refundMethod === m
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional notes */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Notes (optional)</label>
              <input className="input-field" placeholder="e.g. Refund given at reception counter"
                value={refundForm.refundNotes}
                onChange={e => setRefundForm(f => ({ ...f, refundNotes: e.target.value }))} />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              ⚠ This will cancel the appointment and mark the full amount as refunded. A refund receipt will print automatically.
            </div>

            <div className="flex gap-3">
              <button onClick={() => setRefundModal(false)} className="btn-secondary flex-1">Back</button>
              <button onClick={handleCancelWithRefund} disabled={processingRefund}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60">
                <FiXCircle size={16} />
                {processingRefund ? 'Processing...' : 'Cancel & Refund'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
