import { useState, useEffect, useCallback } from 'react';
import { insuranceReportService, doctorService } from '../../services';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiPrinter, FiDownload,
  FiFileText, FiFilter, FiX, FiDollarSign, FiBarChart2, FiTag,
  FiUser, FiActivity, FiCheckCircle,
} from 'react-icons/fi';

/* ── Helpers ── */
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
const fmtMoney = (n) => `LKR ${Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`;

const totalOf = (r) =>
  (r.consultationFee || 0) + (r.labTestCharges || 0) +
  (r.medicineCost || 0) + (r.roomCharges || 0) + (r.otherCharges || 0);

const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

const STATUS_COLORS = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-50 text-red-700 border-red-200',
};
const STATUS_OPTS = ['pending', 'submitted', 'approved', 'rejected'];

/* ── PDF Builder ── */
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

const buildReportHtml = (r, logoSrc) => {
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${CLINIC.name}" style="height:64px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : '';
  const total = totalOf(r);
  const docAttach = (r.attachedDocuments || []).map(d =>
    `<li>${d.label}${d.note ? ' — ' + d.note : ''}</li>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Insurance Report #${r.reportNumber}</title>
  <style>
    body{font-family:'Segoe UI',sans-serif;margin:0;padding:28px;color:#1a1a1a;font-size:13px}
    .page{max-width:750px;margin:0 auto}
    .header{text-align:center;border-bottom:2px solid #2563eb;padding-bottom:14px;margin-bottom:18px}
    .clinic-name{font-size:22px;font-weight:800;color:#2563eb;margin-bottom:4px}
    .clinic-sub{font-size:12px;color:#4b5563;line-height:1.7}
    .report-title{text-align:center;font-size:17px;font-weight:700;color:#1e40af;margin:14px 0;letter-spacing:.5px}
    h3{font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.07em;margin:16px 0 8px;border-bottom:1px solid #e0e7ff;padding-bottom:4px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .field-block{margin-bottom:6px}
    .fl{font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
    .fv{font-size:13px;font-weight:600;color:#111827}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th{background:#2563eb;color:#fff;padding:8px;text-align:left;font-size:11px}
    td{padding:7px 8px;border-bottom:1px solid #f0f0f0}
    .total-row{background:#eef2ff;font-weight:700}
    .status{display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:capitalize;border:1px solid currentColor}
    .footer{margin-top:20px;text-align:center;color:#9ca3af;font-size:10px;border-top:1px solid #e5e7eb;padding-top:10px}
    @media print{body{padding:10px}}
  </style>
</head><body><div class="page">
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address} &nbsp;|&nbsp; ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
  </div>
  <div class="report-title">Medical Insurance Report — Ref #IR-${String(r.reportNumber).padStart(4,'0')}</div>

  <h3>Patient Information</h3>
  <div class="grid2">
    <div class="field-block"><div class="fl">Full Name</div><div class="fv">${r.patientName}</div></div>
    <div class="field-block"><div class="fl">NIC</div><div class="fv">${r.nic}</div></div>
    <div class="field-block"><div class="fl">Phone</div><div class="fv">${r.contactPhone || '—'}</div></div>
    <div class="field-block"><div class="fl">Email</div><div class="fv">${r.contactEmail || '—'}</div></div>
  </div>

  <h3>Insurance Details</h3>
  <div class="grid2">
    <div class="field-block"><div class="fl">Insurance Company</div><div class="fv">${r.insuranceCompany}</div></div>
    <div class="field-block"><div class="fl">Policy Number</div><div class="fv">${r.policyNumber}</div></div>
    <div class="field-block"><div class="fl">Claim Status</div><div class="fv">${r.claimStatus.toUpperCase()}</div></div>
    <div class="field-block"><div class="fl">Report Date</div><div class="fv">${fmt(r.createdAt)}</div></div>
  </div>

  <h3>Hospital &amp; Medical Details</h3>
  <div class="grid2">
    <div class="field-block"><div class="fl">Hospital</div><div class="fv">${r.hospitalName}</div></div>
    <div class="field-block"><div class="fl">Admission Date</div><div class="fv">${fmt(r.admissionDate)}</div></div>
    <div class="field-block"><div class="fl">Discharge Date</div><div class="fv">${fmt(r.dischargeDate)}</div></div>
    <div class="field-block"><div class="fl">Diagnosis</div><div class="fv">${r.diagnosis}</div></div>
    <div class="field-block"><div class="fl">Attending Doctor</div><div class="fv">Dr. ${r.doctorName || '—'}</div></div>
    <div class="field-block"><div class="fl">Doctor SLMC Reg</div><div class="fv">${r.slmcNumber || '—'}</div></div>
  </div>
  ${r.treatmentDetails ? `<div class="field-block"><div class="fl">Treatment Details</div><div class="fv">${r.treatmentDetails}</div></div>` : ''}
  ${r.doctorNotes ? `<div class="field-block"><div class="fl">Doctor Notes</div><div class="fv">${r.doctorNotes}</div></div>` : ''}

  <h3>Cost Breakdown</h3>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Amount (LKR)</th></tr></thead>
    <tbody>
      <tr><td>Consultation Fee</td><td style="text-align:right">${Number(r.consultationFee||0).toFixed(2)}</td></tr>
      <tr><td>Lab / Test Charges</td><td style="text-align:right">${Number(r.labTestCharges||0).toFixed(2)}</td></tr>
      <tr><td>Medicine Cost</td><td style="text-align:right">${Number(r.medicineCost||0).toFixed(2)}</td></tr>
      <tr><td>Room Charges</td><td style="text-align:right">${Number(r.roomCharges||0).toFixed(2)}</td></tr>
      <tr><td>Other Charges</td><td style="text-align:right">${Number(r.otherCharges||0).toFixed(2)}</td></tr>
      <tr class="total-row"><td><strong>Grand Total</strong></td><td style="text-align:right;color:#1d4ed8;font-size:16px"><strong>LKR ${total.toFixed(2)}</strong></td></tr>
    </tbody>
  </table>

  ${docAttach ? `<h3>Attached Documents</h3><ul>${docAttach}</ul>` : ''}

  <div class="footer">${CLINIC.name} &bull; Computer-generated insurance report &bull; ${new Date().toLocaleString()}</div>
</div></body></html>`;
};

/* ── Empty form ── */
const EMPTY = {
  patientName: '', nic: '', contactPhone: '', contactEmail: '',
  insuranceCompany: '', policyNumber: '',
  hospitalName: CLINIC.name, admissionDate: '', dischargeDate: '',
  diagnosis: '', treatmentDetails: '', doctorNotes: '',
  doctorName: '', slmcNumber: '',
  consultationFee: '', labTestCharges: '', medicineCost: '', roomCharges: '', otherCharges: '',
  claimStatus: 'pending',
  attachedDocuments: [],
};

/* ── Summary Card ── */
function SummaryCard({ icon: Icon, label, value, color, small }) {
  return (
    <div className={`card flex items-center gap-4 border-l-4 ${color}`}>
      <div className="w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center flex-shrink-0">
        <Icon size={22} className="text-current opacity-80" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`font-display font-bold text-gray-900 mt-0.5 ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function InsuranceReports() {
  const [reports, setReports] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [newDoc, setNewDoc] = useState({ label: '', note: '' });

  // Filters
  const [search, setSearch] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterPolicy, setFilterPolicy] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCompany) params.insuranceCompany = filterCompany;
      if (filterPolicy) params.policyNumber = filterPolicy;
      if (filterStatus) params.claimStatus = filterStatus;
      if (filterFrom) params.fromDate = filterFrom;
      if (filterTo) params.toDate = filterTo;
      const [rRes, sRes, docsRes] = await Promise.all([
        insuranceReportService.getAll(params),
        insuranceReportService.getSummary(),
        doctorService.getAll(),
      ]);
      setReports(rRes.data);
      setSummary(sRes.data);
      setDoctors(docsRes.data);
    } catch { toast.error('Failed to load reports'); }
    finally { setLoading(false); }
  }, [search, filterCompany, filterPolicy, filterStatus, filterFrom, filterTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      patientName: r.patientName, nic: r.nic,
      contactPhone: r.contactPhone || '', contactEmail: r.contactEmail || '',
      insuranceCompany: r.insuranceCompany, policyNumber: r.policyNumber,
      hospitalName: r.hospitalName,
      admissionDate: fmtInput(r.admissionDate), dischargeDate: fmtInput(r.dischargeDate),
      diagnosis: r.diagnosis, treatmentDetails: r.treatmentDetails || '', doctorNotes: r.doctorNotes || '',
      doctorName: r.doctorName || '', slmcNumber: r.slmcNumber || '',
      consultationFee: r.consultationFee || '', labTestCharges: r.labTestCharges || '',
      medicineCost: r.medicineCost || '', roomCharges: r.roomCharges || '', otherCharges: r.otherCharges || '',
      claimStatus: r.claimStatus,
      attachedDocuments: r.attachedDocuments || [],
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'selectedDoctorId') {
      const doc = doctors.find(d => d._id === value);
      if (doc) {
        setForm(p => ({ ...p, doctorName: doc.name, slmcNumber: doc.slmcNumber || '' }));
      }
    } else {
      setForm(p => ({ ...p, [name]: value }));
    }
  };

  const addDoc = () => {
    if (!newDoc.label.trim()) return;
    setForm(p => ({ ...p, attachedDocuments: [...(p.attachedDocuments || []), { ...newDoc }] }));
    setNewDoc({ label: '', note: '' });
  };
  const removeDoc = (i) => setForm(p => ({ ...p, attachedDocuments: p.attachedDocuments.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await insuranceReportService.update(editing._id, form);
        toast.success('Report updated');
      } else {
        await insuranceReportService.create(form);
        toast.success('Report created');
      }
      closeForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id, claimStatus) => {
    try {
      await insuranceReportService.updateStatus(id, { claimStatus });
      toast.success(`Status updated to ${claimStatus}`);
      fetchAll();
    } catch { toast.error('Status update failed'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Soft-delete this report?')) return;
    try {
      await insuranceReportService.delete(id);
      toast.success('Report deleted');
      fetchAll();
    } catch { toast.error('Delete failed'); }
  };

  const handlePrint = async (r) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=820,height=1050');
    win.document.write(buildReportHtml(r, logo));
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handleDownload = async (r) => {
    const logo = await getLogoBase64();
    const blob = new Blob([buildReportHtml(r, logo)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `insurance-report-${r.patientName.replace(/\s+/g, '-')}-IR${r.reportNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded!');
  };

  const clearFilters = () => {
    setSearch(''); setFilterCompany(''); setFilterPolicy('');
    setFilterStatus(''); setFilterFrom(''); setFilterTo('');
  };

  const formTotal = [form.consultationFee, form.labTestCharges, form.medicineCost, form.roomCharges, form.otherCharges]
    .reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Insurance Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Medical insurance claim submissions &amp; tracking</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> New Report
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={FiFileText} label="Total Reports" value={summary.total} color="border-primary-500 text-primary-600" />
          <SummaryCard icon={FiDollarSign} label="Total Claimed" value={`LKR ${Number(summary.totalAmount||0).toLocaleString()}`} color="border-emerald-500 text-emerald-600" small />
          <SummaryCard icon={FiCheckCircle} label="Approved" value={summary.byStatus?.approved ?? 0} color="border-teal-500 text-teal-600" />
          <SummaryCard icon={FiActivity} label="Pending" value={summary.byStatus?.pending ?? 0} color="border-amber-500 text-amber-600" />
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><FiFilter size={15} />Filters</p>
          <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors">
            <FiX size={13} /> Clear
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="relative col-span-2 sm:col-span-1">
            <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-9 text-sm" placeholder="Name / NIC" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <input className="input-field text-sm" placeholder="Insurance company" value={filterCompany} onChange={e => setFilterCompany(e.target.value)} />
          <input className="input-field text-sm" placeholder="Policy number" value={filterPolicy} onChange={e => setFilterPolicy(e.target.value)} />
          <select className="input-field text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <input type="date" className="input-field text-sm" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className="input-field text-sm" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-16">
          <FiFileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No reports found</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Ref #','Patient','Policy','Insurance Co.','Admission','Total','Status','Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.map(r => (
                  <tr key={r._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        IR-{String(r.reportNumber).padStart(4,'0')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{r.patientName}</p>
                      <p className="text-xs text-gray-400">{r.nic}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600 font-mono text-xs">{r.policyNumber}</td>
                    <td className="px-4 py-4 text-gray-700">{r.insuranceCompany}</td>
                    <td className="px-4 py-4 text-gray-600">{fmt(r.admissionDate)}</td>
                    <td className="px-4 py-4 font-bold text-gray-900">{fmtMoney(totalOf(r))}</td>
                    <td className="px-4 py-4">
                      <select
                        value={r.claimStatus}
                        onChange={e => handleStatusChange(r._id, e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded-full border cursor-pointer focus:outline-none ${STATUS_COLORS[r.claimStatus]}`}
                      >
                        {STATUS_OPTS.map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handlePrint(r)} title="Print" className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"><FiPrinter size={14} /></button>
                        <button onClick={() => handleDownload(r)} title="Download" className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><FiDownload size={14} /></button>
                        <button onClick={() => openEdit(r)} title="Edit" className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><FiEdit2 size={14} /></button>
                        <button onClick={() => handleDelete(r._id)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><FiTrash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-gray-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <p className="font-display font-bold text-gray-900 text-lg">
                  {editing ? 'Edit Insurance Report' : 'New Insurance Report'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Complete all required fields (*)</p>
              </div>
              <button onClick={closeForm} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Patient */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiUser size={12} />Patient Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="label-text">Patient Name *</label>
                    <input name="patientName" required value={form.patientName} onChange={handleChange} className="input-field" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="label-text">NIC *</label>
                    <input name="nic" required value={form.nic} onChange={handleChange} className="input-field" placeholder="National ID" />
                  </div>
                  <div>
                    <label className="label-text">Phone</label>
                    <input name="contactPhone" value={form.contactPhone} onChange={handleChange} className="input-field" placeholder="Contact number" />
                  </div>
                  <div>
                    <label className="label-text">Email</label>
                    <input name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} className="input-field" placeholder="e.g. patient@email.com" />
                  </div>
                </div>
              </section>

              {/* Insurance */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiTag size={12} />Insurance Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Insurance Company *</label>
                    <input name="insuranceCompany" required value={form.insuranceCompany} onChange={handleChange} className="input-field" placeholder="e.g. AIA Insurance" />
                  </div>
                  <div>
                    <label className="label-text">Policy Number *</label>
                    <input name="policyNumber" required value={form.policyNumber} onChange={handleChange} className="input-field" placeholder="e.g. POL-20241234" />
                  </div>
                </div>
              </section>

              {/* Medical */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiActivity size={12} />Medical Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Hospital Name *</label>
                    <input name="hospitalName" required value={form.hospitalName} onChange={handleChange} className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Diagnosis *</label>
                    <input name="diagnosis" required value={form.diagnosis} onChange={handleChange} className="input-field" placeholder="e.g. Dengue Fever" />
                  </div>
                  <div>
                    <label className="label-text">Admission Date *</label>
                    <input name="admissionDate" type="date" required value={form.admissionDate} onChange={handleChange} className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Discharge Date</label>
                    <input name="dischargeDate" type="date" value={form.dischargeDate} onChange={handleChange} className="input-field" />
                  </div>
                  <div className="col-span-2">
                    <label className="label-text">Select Doctor (Select to auto-fill)</label>
                    <select name="selectedDoctorId" onChange={handleChange} className="input-field">
                      <option value="">-- Choose a Doctor --</option>
                      {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} {d.slmcNumber ? `(${d.slmcNumber})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Doctor Name</label>
                    <input name="doctorName" value={form.doctorName} onChange={handleChange} className="input-field" placeholder="Dr. Name" />
                  </div>
                  <div>
                    <label className="label-text">SLMC Reg. No</label>
                    <input name="slmcNumber" value={form.slmcNumber} onChange={handleChange} className="input-field" placeholder="SLMC/..." />
                  </div>
                  <div className="col-span-2">
                    <label className="label-text">Treatment Details</label>
                    <textarea name="treatmentDetails" rows={2} value={form.treatmentDetails} onChange={handleChange} className="input-field resize-none" placeholder="Describe treatment..." />
                  </div>
                  <div className="col-span-2">
                    <label className="label-text">Doctor Notes</label>
                    <textarea name="doctorNotes" rows={2} value={form.doctorNotes} onChange={handleChange} className="input-field resize-none" placeholder="Doctor's remarks..." />
                  </div>
                </div>
              </section>

              {/* Costs */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiDollarSign size={12} />Cost Breakdown (LKR)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { name: 'consultationFee', label: 'Consultation Fee' },
                    { name: 'labTestCharges', label: 'Lab / Test Charges' },
                    { name: 'medicineCost', label: 'Medicine Cost' },
                    { name: 'roomCharges', label: 'Room Charges' },
                    { name: 'otherCharges', label: 'Other Charges' },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="label-text">{f.label}</label>
                      <input name={f.name} type="number" min="0" step="0.01" value={form[f.name]} onChange={handleChange} className="input-field" placeholder="0.00" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between items-center bg-indigo-50 rounded-xl px-4 py-3">
                  <span className="text-sm font-semibold text-gray-700">Total Claim Amount</span>
                  <span className="text-xl font-display font-bold text-indigo-600">{fmtMoney(formTotal)}</span>
                </div>
              </section>

              {/* Attached Docs */}
              <section>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FiFileText size={12} />Attached Documents</p>
                <div className="space-y-2 mb-3">
                  {(form.attachedDocuments || []).map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{d.label}</p>
                        {d.note && <p className="text-xs text-gray-400">{d.note}</p>}
                      </div>
                      <button type="button" onClick={() => removeDoc(i)} className="text-red-400 hover:text-red-600 p-1 transition-colors"><FiX size={14} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="input-field flex-1 text-sm" placeholder="Document label (e.g. Lab Report)" value={newDoc.label} onChange={e => setNewDoc(p => ({ ...p, label: e.target.value }))} />
                  <input className="input-field flex-1 text-sm" placeholder="Note (optional)" value={newDoc.note} onChange={e => setNewDoc(p => ({ ...p, note: e.target.value }))} />
                  <button type="button" onClick={addDoc} className="btn-secondary px-3 flex-shrink-0 text-sm flex items-center gap-1"><FiPlus size={14} />Add</button>
                </div>
              </section>

              {/* Status */}
              <section>
                <label className="label-text">Claim Status</label>
                <select name="claimStatus" value={form.claimStatus} onChange={handleChange} className="input-field">
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </section>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editing ? 'Update Report' : 'Create Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
