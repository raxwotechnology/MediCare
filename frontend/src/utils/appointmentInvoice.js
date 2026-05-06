/* ─────────────────────────────────────────────────────────────────────────────
   Builds a printable / downloadable HTML invoice for an appointment.
   Includes the consultation line, every paid extra-charge line, and a
   per-method payment summary so split payments are clearly itemised.
   ──────────────────────────────────────────────────────────────────────────── */

const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

/** Fetch logo.png and convert to a base64 data-URL so it survives in the
 *  print popup and downloaded file. */
export const getLogoBase64 = async () => {
  try {
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
};

const methodLabel = {
  cash: 'Cash', card: 'Card', online: 'Online',
};

/** Aggregate every payment (reception + extras) by method.  Note that
 *  splits[].amount represents the TENDERED amount, so we subtract any
 *  change returned (always given as cash) from the cash bucket to show
 *  net per-method income. */
const aggregatePayments = (appt) => {
  const out = { cash: 0, card: 0, online: 0 };

  const addPayment = (p) => {
    if (!p) return;
    const splits = p.splits || p.paymentSplits;
    if (Array.isArray(splits) && splits.length > 0) {
      for (const s of splits) {
        if (out[s.method] !== undefined) out[s.method] += Number(s.amount || 0);
      }
    } else if (p.paymentMethod && (p.amount || p.totalPaid || p.totalAmount)) {
      const amt = Number(p.amount || p.totalPaid || p.totalAmount || 0);
      if (out[p.paymentMethod] !== undefined) out[p.paymentMethod] += amt;
    }
    // Subtract change (always returned as cash) from the cash bucket
    const change = Number(p.changeGiven || 0);
    if (change > 0) out.cash = Math.max(0, out.cash - change);
  };

  addPayment(appt.receptionPayment);
  for (const c of appt.extraCharges || []) {
    if (c.isPaid) addPayment(c);
  }
  return out;
};

const fmt = (n) => `LKR ${Number(n || 0).toFixed(2)}`;

export const buildAppointmentInvoiceHtml = (appt, logoSrc) => {
  const logoHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${CLINIC.name}" style="height:64px;object-fit:contain;display:block;margin:0 auto 8px;" />`
    : '';

  // Line items: main consultation + every extra charge (paid or unpaid)
  const lineItems = [];
  lineItems.push({
    label: appt.serviceName || appt.service?.name || 'Consultation',
    sub: `Dr. ${appt.doctor?.name || appt.doctorName || ''}`,
    price: appt.price,
    paid: ['paid', 'with_doctor', 'completed'].includes(appt.status),
    method: appt.receptionPayment?.paymentMethod || '',
    splits: appt.receptionPayment?.splits || [],
  });
  for (const c of appt.extraCharges || []) {
    lineItems.push({
      label: c.serviceName,
      sub: c.description || 'Extra service',
      price: c.price,
      paid: c.isPaid,
      method: c.paymentMethod || '',
      splits: c.paymentSplits || [],
    });
  }

  const itemsRows = lineItems.map((it) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0">
        <div style="font-weight:600">${it.label}</div>
        <div style="font-size:11px;color:#6b7280">${it.sub || ''}</div>
      </td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${fmt(it.price)}</td>
      <td style="padding:8px;border-bottom:1px solid #f0f0f0;text-align:center">
        <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
          ${it.paid ? 'background:#d1fae5;color:#065f46' : 'background:#fef3c7;color:#92400e'}">
          ${it.paid ? '✓ Paid' : 'Unpaid'}
        </span>
      </td>
    </tr>`).join('');

  const subtotal = lineItems.reduce((s, x) => s + Number(x.price || 0), 0);
  const paidTotal = lineItems
    .filter(x => x.paid)
    .reduce((s, x) => s + Number(x.price || 0), 0);
  const balance = subtotal - paidTotal;

  // Payment-method aggregation
  const buckets = aggregatePayments(appt);
  const paymentRows = ['cash', 'card', 'online']
    .filter(m => buckets[m] > 0)
    .map(m => `
      <tr>
        <td style="padding:5px 8px;color:#374151">${methodLabel[m]}</td>
        <td style="padding:5px 8px;text-align:right;font-weight:600">${fmt(buckets[m])}</td>
      </tr>`).join('');

  // Aggregate tendered + change owed across reception payment + paid extras
  const cashSources = [appt.receptionPayment, ...(appt.extraCharges || [])];
  const tenderedTotal = cashSources.reduce(
    (s, x) => s + Number(x?.totalTendered || x?.cashTendered || 0), 0
  );
  const changeGivenTotal = cashSources.reduce((s, x) => s + Number(x?.changeGiven || 0), 0);

  const changeRows = changeGivenTotal > 0
    ? `<tr>
         <td style="padding:5px 8px;color:#374151;border-top:1px dashed #d1d5db">Cash Given</td>
         <td style="padding:5px 8px;text-align:right;font-weight:600;border-top:1px dashed #d1d5db">${fmt(tenderedTotal)}</td>
       </tr>
       <tr>
         <td style="padding:5px 8px;color:#047857;font-weight:700">Change Returned</td>
         <td style="padding:5px 8px;text-align:right;font-weight:800;color:#047857">${fmt(changeGivenTotal)}</td>
       </tr>`
    : '';

  const paymentSummary = (paymentRows.length > 0 || changeRows)
    ? `<div style="margin-top:14px;padding:10px 14px;background:#f8faff;border-radius:8px">
         <div style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:6px">
           Payment Breakdown
         </div>
         <table style="width:100%;font-size:12px">${paymentRows}${changeRows}</table>
       </div>`
    : '';

  const queueLine = appt.queueNumber
    ? `<div style="color:#6b7280">Queue #${appt.queueNumber}</div>`
    : '';

  const balanceLine = balance > 0
    ? `<tr style="background:#fff7ed">
         <td colspan="2" style="padding:10px 8px;text-align:right;font-weight:700;color:#9a3412">Balance Due</td>
         <td style="padding:10px 8px;text-align:right;font-weight:800;color:#9a3412">${fmt(balance)}</td>
       </tr>`
    : '';

  const invoiceNo = appt.invoiceNumber
    || `INV-${(appt._id || '').toString().slice(-6).toUpperCase()}`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Invoice ${invoiceNo}</title>
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
    .items thead{background:#2563eb;color:#fff}
    .items thead th{padding:8px;text-align:left;font-size:12px}
    .total-row{background:#f0f4ff;font-weight:800}
    .total-row td{padding:10px 8px;font-size:15px}
    .footer{margin-top:20px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:10px}
    @media print{body{padding:10px}}
  </style></head><body>

  <div class="header">
    ${logoHtml}
    <div class="clinic-name">${CLINIC.name}</div>
    <div class="clinic-sub">${CLINIC.address}</div>
    <div class="clinic-sub">Tel: ${CLINIC.phone} &nbsp;|&nbsp; ${CLINIC.email}</div>
    <div style="font-size:15px;font-weight:700;margin:10px 0 2px">Appointment Invoice</div>
    <div style="font-size:12px;color:#6b7280">${invoiceNo} &bull; ${new Date().toLocaleString()}</div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Patient</div>
      <div class="meta-value">${appt.patientName || ''}</div>
      <div style="color:#6b7280">${appt.patientPhone || ''}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Doctor</div>
      <div class="meta-value">Dr. ${appt.doctor?.name || appt.doctorName || ''}</div>
      <div style="color:#6b7280">${appt.doctor?.specialization || ''}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">Appointment</div>
      <div class="meta-value">${appt.appointmentDate || ''}</div>
      ${queueLine}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Service / Item</th>
        <th style="text-align:right">Amount</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td style="padding:10px 8px;text-align:right">Subtotal</td>
        <td style="padding:10px 8px;text-align:right;color:#2563eb">${fmt(subtotal)}</td>
        <td></td>
      </tr>
      <tr style="background:#ecfdf5">
        <td colspan="2" style="padding:10px 8px;text-align:right;font-weight:700;color:#065f46">Total Paid</td>
        <td style="padding:10px 8px;text-align:right;font-weight:800;color:#065f46">${fmt(paidTotal)}</td>
      </tr>
      ${balanceLine}
    </tfoot>
  </table>

  ${paymentSummary}

  <div class="footer">
    ${CLINIC.name} &bull; ${CLINIC.address} &bull; ${CLINIC.phone}
    &bull; Computer-generated invoice
  </div>
  </body></html>`;
};

/** Open the invoice in a print-ready popup. */
export const printAppointmentInvoice = async (appt) => {
  const logo = await getLogoBase64();
  const html = buildAppointmentInvoiceHtml(appt, logo);
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
};

/** Download the invoice as a standalone HTML file. */
export const downloadAppointmentInvoice = async (appt) => {
  const logo = await getLogoBase64();
  const html = buildAppointmentInvoiceHtml(appt, logo);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoice-${(appt.patientName || 'patient').replace(/\s+/g, '-')}-${appt.invoiceNumber || appt._id}.html`;
  a.click();
  URL.revokeObjectURL(url);
};
