import { useState, useEffect, useCallback } from 'react';
import { medicalCertificateService, doctorService } from '../../services';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiPrinter, FiDownload,
  FiFileText, FiCalendar, FiFilter, FiX, FiCheckCircle, FiAlertCircle,
  FiUser, FiBarChart2, FiRefreshCw,
} from 'react-icons/fi';

/* ── Helpers ── */
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const fmtInput = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

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

const buildCertHtml = (cert, logoSrc, mode = 'print') => {
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${CLINIC.name}" style="height:64px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : '';

  const safeName = (cert.patientName || 'patient').replace(/\s+/g, '-');
  const certNo = `MC-${String(cert.certificateNumber).padStart(4, '0')}`;

  const pdfScript = mode === 'download' ? `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      function generatePDF() {
        var btn = document.getElementById('pdf-btn');
        if (btn) btn.style.display = 'none';
        html2pdf().set({
          margin: 0,
          filename: 'medical-cert-${safeName}-${certNo}.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(document.getElementById('cert-root')).save().then(function(){
          if (btn) btn.style.display = '';
        });
      }
      window.addEventListener('load', function(){ setTimeout(generatePDF, 700); });
    <\/script>` : '';

  const pdfBtn = mode === 'download'
    ? `<div style="text-align:center;margin:16px 0 4px"><button id="pdf-btn" onclick="generatePDF()" style="background:#000;color:#fff;border:none;padding:10px 28px;font-size:13px;font-weight:700;letter-spacing:.05em;border-radius:3px;cursor:pointer;font-family:Arial,sans-serif;">⬇ Download PDF</button></div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Medical Certificate ${certNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 6.35mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; font-size: 11.5pt; }
    #cert-root { width: 210mm; min-height: 297mm; padding: 6.35mm; margin: 0 auto; }
    .inner { border: 2px solid #000; padding: 22px 26px; }
    .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 14px; margin-bottom: 16px; }
    .clinic-name { font-size: 16pt; font-weight: 700; letter-spacing: .04em;  }
    .clinic-sub { font-size: 8.5pt; color: #444; line-height: 1.7; font-family: Arial, sans-serif; }
    .cert-title { font-size: 13pt; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: .1em; margin: 12px 0 3px; font-family: Arial, sans-serif; }
    .cert-number { text-align: center; font-size: 8.5pt; color: #555; font-family: Arial, sans-serif; margin-bottom: 14px; }
    .body-text { font-size: 11pt; line-height: 1.9; margin-bottom: 10px; }
    .val { font-weight: 700; }
    .diag-box { margin: 12px 0; padding: 10px 14px; border-left: 4px solid #000; background: #f5f5f5; }
    .diag-label { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-family: Arial, sans-serif; margin-bottom: 3px; color: #333; }
    .diag-value { font-size: 11.5pt; font-weight: 700; }
    .diag-remark { font-size: 9.5pt; color: #333; margin-top: 5px; font-family: Arial, sans-serif; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; margin-top: 32px; page-break-inside: avoid; }
    .sig-box { text-align: center; }
    .sig-space { height: 52px; }
    .sig-line { border-top: 1px solid #000; padding-top: 6px; font-size: 8.5pt; color: #333; font-family: Arial, sans-serif; line-height: 1.6; }
    .stamp-box { width: 80px; height: 64px; border: 1.5px dashed #999; margin: 4px auto; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 8pt; font-family: Arial, sans-serif; }
    .footer { margin-top: 18px; text-align: center; font-size: 7.5pt; color: #777; border-top: 1px solid #ccc; padding-top: 9px; font-family: Arial, sans-serif; line-height: 1.6; }
    @media print {
      body { margin: 0; }
      #cert-root { padding: 6.35mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      #pdf-btn { display: none !important; }
      .sig-row { page-break-inside: avoid; }
    }
  </style>
  ${pdfScript}
</head><body>
<div id="cert-root"><div class="inner">
  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
  </div>

  <div class="cert-title">Medical Certificate</div>
  <div class="cert-number">Certificate No: <strong>${certNo}</strong> &nbsp;&bull;&nbsp; Issued: ${fmt(cert.createdAt)}</div>

  <p class="body-text">This is to certify that <span class="val">${cert.patientName}</span>, aged <span class="val">${cert.age}</span> years, Gender: <span class="val">${cert.gender}</span>, NIC / Student ID: <span class="val">${cert.nicOrStudentId}</span>, was examined by me on <span class="val">${fmt(cert.examinationDate)}</span>.</p>

  <div class="diag-box">
    <div class="diag-label">Diagnosis</div>
    <div class="diag-value">${cert.diagnosis}</div>
    ${cert.remarks ? `<div class="diag-remark"><strong>Remarks:</strong> ${cert.remarks}</div>` : ''}
  </div>

  <p class="body-text">The above-named patient is hereby certified to be <strong>unfit for examinations / academic duties</strong> from <span class="val">${fmt(cert.unfitFromDate)}</span> to <span class="val">${fmt(cert.unfitToDate)}</span> (inclusive).</p>

  <div class="sig-row">
    <div class="sig-box">
      <div class="sig-space"></div>
      <div class="sig-line"><strong>Dr. ${cert.doctorName}</strong><br>SLMC Reg. No: ${cert.slmcNumber}<br>${cert.hospitalName}</div>
    </div>
    <div class="sig-box">
      <div class="sig-space"></div>
      <div class="sig-line">Hospital / Clinic Seal</div>
    </div>
  </div>

  <div class="footer">${CLINIC.name} &bull; This certificate is computer-generated and valid without a physical signature if issued via an official electronic system.</div>
  ${pdfBtn}
</div></div>
</body></html>`;
};

/* ── Empty form ── */
const EMPTY = {
  patientName: '', nicOrStudentId: '', age: '', gender: 'Male',
  examinationDate: '', diagnosis: '', unfitFromDate: '', unfitToDate: '',
  doctorName: '', slmcNumber: '', hospitalName: CLINIC.name, remarks: '',
};

/* ── Summary Card ── */
function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`card flex items-center gap-4 border-l-4 ${color}`}>
      <div className="w-12 h-12 rounded-2xl bg-current/10 flex items-center justify-center flex-shrink-0">
        <Icon size={22} className="text-current opacity-80" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-display font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function MedicalCertificates() {
  const [certs, setCerts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterDoctor) params.doctorName = filterDoctor;
      if (filterFrom) params.fromDate = filterFrom;
      if (filterTo) params.toDate = filterTo;
      const [certsRes, sumRes, docsRes] = await Promise.all([
        medicalCertificateService.getAll(params),
        medicalCertificateService.getSummary(),
        doctorService.getAll(),
      ]);
      setCerts(certsRes.data);
      setSummary(sumRes.data);
      setDoctors(docsRes.data);
    } catch { toast.error('Failed to load certificates'); }
    finally { setLoading(false); }
  }, [search, filterDoctor, filterFrom, filterTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({
      patientName: c.patientName, nicOrStudentId: c.nicOrStudentId,
      age: c.age, gender: c.gender,
      examinationDate: fmtInput(c.examinationDate),
      diagnosis: c.diagnosis,
      unfitFromDate: fmtInput(c.unfitFromDate),
      unfitToDate: fmtInput(c.unfitToDate),
      doctorName: c.doctorName, slmcNumber: c.slmcNumber,
      hospitalName: c.hospitalName, remarks: c.remarks || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await medicalCertificateService.update(editing._id, form);
        toast.success('Certificate updated');
      } else {
        await medicalCertificateService.create(form);
        toast.success('Certificate created');
      }
      closeForm();
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Soft-delete this certificate?')) return;
    setDeleting(id);
    try {
      await medicalCertificateService.delete(id);
      toast.success('Certificate deleted');
      fetchAll();
    } catch { toast.error('Delete failed'); }
    finally { setDeleting(null); }
  };

  const handlePrint = async (cert) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=800,height=1000');
    win.document.write(buildCertHtml(cert, logo, 'print'));
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const handleDownload = async (cert) => {
    const logo = await getLogoBase64();
    const win = window.open('', '_blank', 'width=800,height=1000');
    win.document.write(buildCertHtml(cert, logo, 'download'));
    win.document.close();
    toast.success('PDF download starting...');
  };

  const clearFilters = () => { setSearch(''); setFilterDoctor(''); setFilterFrom(''); setFilterTo(''); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Medical Certificates</h1>
          <p className="text-sm text-gray-500 mt-1">Generate &amp; manage exam-absence medical certificates</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> New Certificate
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryCard icon={FiFileText} label="Total Issued" value={summary.total} color="border-primary-500 text-primary-600" />
          <SummaryCard icon={FiBarChart2} label="Top Diagnosis" value={summary.topDiagnoses?.[0]?._id || '—'} color="border-teal-500 text-teal-600" />
          <SummaryCard icon={FiCalendar} label="This Month" value={summary.perMonth?.at(-1)?.count ?? 0} color="border-violet-500 text-violet-600" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-9 text-sm" placeholder="Name or NIC / Student ID" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <input className="input-field text-sm" placeholder="Doctor name" value={filterDoctor}
            onChange={e => setFilterDoctor(e.target.value)} />
          <input type="date" className="input-field text-sm" value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)} />
          <input type="date" className="input-field text-sm" value={filterTo}
            onChange={e => setFilterTo(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : certs.length === 0 ? (
        <div className="card text-center py-16">
          <FiFileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No certificates found</p>
          <p className="text-xs text-gray-400 mt-1">Create the first one using the button above</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">#</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Patient</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">NIC / Student ID</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Exam Date</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Unfit Period</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Doctor</th>
                  <th className="text-left px-5 py-4 font-semibold text-gray-600 text-xs uppercase tracking-wider">Diagnosis</th>
                  <th className="px-5 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {certs.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md">
                        MC-{String(c.certificateNumber).padStart(4, '0')}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{c.patientName}</p>
                      <p className="text-xs text-gray-400">{c.age}y • {c.gender}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 font-mono text-xs">{c.nicOrStudentId}</td>
                    <td className="px-5 py-4 text-gray-600">{fmt(c.examinationDate)}</td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                        {fmt(c.unfitFromDate)} → {fmt(c.unfitToDate)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-800">Dr. {c.doctorName}</p>
                      <p className="text-xs text-gray-400">{c.slmcNumber}</p>
                    </td>
                    <td className="px-5 py-4 max-w-[160px]">
                      <p className="text-gray-600 truncate text-xs">{c.diagnosis}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handlePrint(c)} title="Print"
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                          <FiPrinter size={15} />
                        </button>
                        <button onClick={() => handleDownload(c)} title="Download"
                          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                          <FiDownload size={15} />
                        </button>
                        <button onClick={() => openEdit(c)} title="Edit"
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                          <FiEdit2 size={15} />
                        </button>
                        <button onClick={() => handleDelete(c._id)} disabled={deleting === c._id} title="Delete"
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                          <FiTrash2 size={15} />
                        </button>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <p className="font-display font-bold text-gray-900 text-lg">
                  {editing ? 'Edit Certificate' : 'New Medical Certificate'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Fill in all required fields</p>
              </div>
              <button onClick={closeForm} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                <FiX size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Patient Details */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FiUser size={12} /> Patient Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label-text">Patient Name *</label>
                    <input name="patientName" required value={form.patientName} onChange={handleChange} className="input-field" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="label-text">NIC / Student ID *</label>
                    <input name="nicOrStudentId" required value={form.nicOrStudentId} onChange={handleChange} className="input-field" placeholder="e.g. 200012345678" />
                  </div>
                  <div>
                    <label className="label-text">Age *</label>
                    <input name="age" type="number" min="1" max="120" required value={form.age} onChange={handleChange} className="input-field" placeholder="e.g. 22" />
                  </div>
                  <div>
                    <label className="label-text">Gender *</label>
                    <select name="gender" required value={form.gender} onChange={handleChange} className="input-field">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Medical Details */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FiFileText size={12} /> Medical Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-text">Examination Date *</label>
                    <input name="examinationDate" type="date" required value={form.examinationDate} onChange={handleChange} className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Unfit From *</label>
                    <input name="unfitFromDate" type="date" required value={form.unfitFromDate} onChange={handleChange} className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Unfit To *</label>
                    <input name="unfitToDate" type="date" required value={form.unfitToDate} onChange={handleChange} className="input-field" />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label-text">Diagnosis *</label>
                  <input name="diagnosis" required value={form.diagnosis} onChange={handleChange} className="input-field" placeholder="e.g. Acute Viral Fever" />
                </div>
                <div className="mt-3">
                  <label className="label-text">Remarks (optional)</label>
                  <textarea name="remarks" rows={2} value={form.remarks} onChange={handleChange} className="input-field resize-none" placeholder="Any additional notes..." />
                </div>
              </div>

              {/* Doctor / Clinic */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <FiCheckCircle size={12} /> Doctor &amp; Clinic Info
                </p>
                <div className="mb-3">
                  <label className="label-text">Select Doctor (Select to auto-fill) *</label>
                  <select name="selectedDoctorId" onChange={handleChange} className="input-field">
                    <option value="">-- Choose a Doctor --</option>
                    {doctors.map(d => <option key={d._id} value={d._id}>Dr. {d.name} {d.slmcNumber ? `(${d.slmcNumber})` : ''}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="label-text">Doctor Name *</label>
                    <input name="doctorName" required value={form.doctorName} onChange={handleChange} className="input-field" placeholder="e.g. Dr. Silva" />
                  </div>
                  <div>
                    <label className="label-text">SLMC Reg. No *</label>
                    <input name="slmcNumber" required value={form.slmcNumber} onChange={handleChange} className="input-field" placeholder="e.g. SLMC/12345" />
                  </div>
                  <div>
                    <label className="label-text">Hospital / Clinic *</label>
                    <input name="hospitalName" required value={form.hospitalName} onChange={handleChange} className="input-field" />
                  </div>
                </div>
              </div>

              {/* Validation hint */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <FiAlertCircle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">Unfit dates must cover the examination date. SLMC number must be 3–20 alphanumeric characters.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : editing ? 'Update Certificate' : 'Create Certificate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
