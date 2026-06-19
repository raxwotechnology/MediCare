/* ─────────────────────────────────────────────────────────────────────────────
   Builds a printable / downloadable HTML invoice for an appointment.
   • Print:    Black-and-white professional layout, logo keeps its colour.
   • Download: Saves as PDF via html2pdf.js (loaded from CDN in the popup).
   ──────────────────────────────────────────────────────────────────────────── */

const CLINIC = {
  name: 'Aayu Medi Care 24',
  address: 'Pannala Road, Dankotuwa',
  phone: '0312260097',
  email: 'aayumedicare@gmail.com',
};

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

const methodLabel = { cash: 'Cash', card: 'Card', online: 'Online' };

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
    const change = Number(p.changeGiven || 0);
    if (change > 0) out.cash = Math.max(0, out.cash - change);
  };
  addPayment(appt.receptionPayment);
  for (const c of appt.extraCharges || []) { if (c.isPaid) addPayment(c); }
  return out;
};

const fmt = (n) => `LKR ${Number(n || 0).toFixed(2)}`;

const STYLES = `
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 0.5mm; }
body { font-family: 'Times New Roman', Times, serif; color: #000; background: #fff; font-size: 13pt; }
#invoice-root { width: 210mm; min-height: 297mm; padding: 6.35mm; margin: 0 auto; }
.header { padding: 14px 16px; margin-bottom: 12px; display: flex; flex-direction: row; align-items: center; justify-content: space-between; }
.header-right { display: flex; flex-direction: column; justify-content: center; flex-shrink: 0; margin-left: 16px; }
.header-left { display: flex; align-items: center; justify-content: flex-end; flex-shrink: 0; margin-left: 16px; }
.logo { object-fit: contain; display: block; max-height: 80px; width: auto; }
.clinic-name { font-size: 20pt; font-weight: 700; letter-spacing: .04em; line-height: 1.2; }
.clinic-sub { font-size: 13pt; color: #444; line-height: 1.3; font-family: Arial, sans-serif; }
.header-title { text-align: center; margin-top: 10px; padding-top: 10px; }
.invoice-label { font-size: 17pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 2px; font-family: Arial, sans-serif; }
.invoice-ref { font-size: 10pt; color: #555; font-family: Arial, sans-serif; }
.meta { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; padding-top: 14px; margin-top: 20px; border-top: 1px solid #ccc; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 14px; }
.meta-label { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; font-family: Arial, sans-serif; margin-bottom: 6px; text-align: center; }
.meta-value { font-size: 12pt; font-weight: 700; font-family: Arial, sans-serif; text-align: center; }
.meta-sub { font-size: 11pt; color: #555; font-family: Arial, sans-serif; text-align: center; }
.queue-col { background: #f4f4f4; border: 1.5px solid #ccc; border-radius: 4px; padding: 8px 12px; display: flex; flex-direction: column; justify-content: center; }
.queue-num { font-size: 20pt; font-weight: 800; font-family: 'Courier New', monospace; color: #000; line-height: 1; text-align: center; }
table.items { width: 100%; border-collapse: collapse; margin-bottom: 0; }
table.items thead th { background: #000; color: #fff; padding: 8px 10px; text-align: left; font-size: 10pt; font-family: Arial, sans-serif; letter-spacing: .05em; text-transform: uppercase; }
.th-r { text-align: right !important; } .th-c { text-align: center !important; }
.td-i { padding: 10px 10px; border-bottom: 1px solid #ddd; }
.td-a { padding: 10px 10px; border-bottom: 1px solid #ddd; text-align: right; font-family: 'Courier New', monospace; font-size: 12pt; font-weight: 700; white-space: nowrap; }
.td-s { padding: 10px 10px; border-bottom: 1px solid #ddd; text-align: center; }
.iname { font-weight: 700; font-size: 12pt; font-family: Arial, sans-serif; }
.isub { font-size: 11pt; color: #555; font-family: Arial, sans-serif; margin-top: 2px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 2px; font-size: 9pt; font-weight: 700; font-family: Arial, sans-serif; letter-spacing: .03em; border: 1.5px solid #000; }
.paid { background: #000; color: #fff; } .unpaid { background: #fff; color: #000; }
.tfoot-sub td { padding: 10px 10px; border-top: 2px solid #000; font-family: Arial, sans-serif; font-size: 11pt; font-weight: 700; text-align: right; }
.tfoot-paid td { padding: 8px 10px; font-family: Arial, sans-serif; font-size: 11pt; font-weight: 700; text-align: right; border-bottom: 2px solid #000; }
.tfoot-bal td { padding: 10px 10px; }
.bal-lbl { text-align: right; font-weight: 700; font-family: Arial, sans-serif; font-size: 12pt; }
.bal-amt { text-align: right; font-weight: 800; font-family: 'Courier New', monospace; font-size: 14pt; }
.pay-box { margin-top: 14px; padding: 10px 14px; border: 1.5px solid #ccc; }
.pay-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #555; font-family: Arial, sans-serif; margin-bottom: 6px; }
.pay-tbl { width: 100%; font-size: 12pt; font-family: Arial, sans-serif; }
.pm { padding: 4px 8px; color: #333; font-size: 12pt; } .pa { font-size: 12pt; padding: 4px 8px; text-align: right; font-weight: 700; font-family: 'Courier New', monospace; }
.footer { margin-top: 24px; text-align: center; font-size: 9pt; color: #777; border-top: 1px solid #ccc; padding-top: 10px; font-family: Arial, sans-serif; line-height: 1.6; }
@media print { body { margin: 0; } #invoice-root { padding: 6.35mm; width: 210mm; min-height: 297mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } table.items thead th { background: #000 !important; color: #fff !important; } .paid { background: #000 !important; color: #fff !important; } #pdf-btn { display: none !important; } }
`;

export const buildAppointmentInvoiceHtml = (appt, logoSrc, mode = 'print') => {
  const logoHtml = logoSrc ? `<img src="${logoSrc}" alt="${CLINIC.name}" class="logo" />` : '';

  const lineItems = [];
  lineItems.push({
    label: appt.serviceName || appt.service?.name || 'Consultation',
    sub: `${appt.doctor?.designation || 'Dr.'} ${appt.doctor?.name || appt.doctorName || ''}`,
    price: appt.price,
    paid: ['paid', 'with_doctor', 'completed'].includes(appt.status),
  });
  for (const c of appt.extraCharges || []) {
    lineItems.push({ label: c.serviceName, sub: c.description || 'Extra service', price: c.price, paid: c.isPaid });
  }

  const itemsRows = lineItems.map((it) => `
    <tr>
      <td class="td-i"><div class="iname">${it.label}</div><div class="isub">${it.sub || ''}</div></td>
      <td class="td-s"></td>
      <td class="td-a">${fmt(it.price)}</td>
    </tr>`).join('');

  const subtotal = lineItems.reduce((s, x) => s + Number(x.price || 0), 0);
  const paidTotal = lineItems.filter(x => x.paid).reduce((s, x) => s + Number(x.price || 0), 0);
  const balance = subtotal - paidTotal;

  const buckets = aggregatePayments(appt);
  const payRows = ['cash', 'card', 'online'].filter(m => buckets[m] > 0)
    .map(m => `<tr><td class="pm">${methodLabel[m]}</td><td class="pa">${fmt(buckets[m])}</td></tr>`).join('');

  const cashSources = [appt.receptionPayment, ...(appt.extraCharges || [])];
  const tendered = cashSources.reduce((s, x) => s + Number(x?.totalTendered || x?.cashTendered || 0), 0);
  const changeGiven = cashSources.reduce((s, x) => s + Number(x?.changeGiven || 0), 0);
  const changeRows = changeGiven > 0
    ? `<tr><td class="pm" style="border-top:1px dashed #999">Cash Given</td><td class="pa" style="border-top:1px dashed #999">${fmt(tendered)}</td></tr>
       <tr><td class="pm" style="font-weight:700">Change Returned</td><td class="pa" style="font-weight:700">${fmt(changeGiven)}</td></tr>`
    : '';

  const payBlock = (payRows || changeRows)
    ? `<div class="pay-box"><div class="pay-title">Paid By</div><table class="pay-tbl">${payRows}${changeRows}</table></div>`
    : '';

  const invoiceNo = appt.invoiceNumber || `INV-${(appt._id || '').toString().slice(-6).toUpperCase()}`;
  const queueCol = appt.queueNumber
    ? `<div><div class="meta-label">Queue No.</div><div class="queue-num">#${appt.queueNumber}</div></div>`
    : `<div><div class="meta-label">Queue No.</div><div class="meta-value">—</div></div>`;
  const balanceLine = balance > 0
    ? `<tr class="tfoot-bal"><td colspan="2" class="bal-lbl">Balance Due</td><td class="bal-amt">${fmt(balance)}</td></tr>` : '';

  const safeName = (appt.patientName || 'patient').replace(/\s+/g, '-');

  const pdfScript = mode === 'download' ? `
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      function generatePDF() {
        var btn = document.getElementById('pdf-btn');
        if (btn) btn.style.display = 'none';
        html2pdf().set({
          margin: 0,
          filename: 'invoice-${safeName}-${invoiceNo}.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(document.getElementById('invoice-root')).save().then(function(){
          if (btn) btn.style.display = '';
        });
      }
      window.addEventListener('load', function(){ setTimeout(generatePDF, 700); });
    <\/script>` : '';

  const pdfBtn = mode === 'download'
    ? `<div style="text-align:center;margin:18px 0 4px"><button id="pdf-btn" onclick="generatePDF()" style="background:#000;color:#fff;border:none;padding:10px 28px;font-size:13px;font-weight:700;letter-spacing:.05em;border-radius:3px;cursor:pointer;font-family:Arial,sans-serif;">⬇ Download PDF</button></div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${invoiceNo}</title><style>${STYLES}</style>${pdfScript}</head><body>
<div id="invoice-root">
  <div class="header">
    <div class="header-left">
      ${logoHtml}
    </div>
    <div class="header-right">
      <div class="clinic-name">${CLINIC.name}</div>
      <div class="clinic-sub">${CLINIC.address}</div>
      <div class="clinic-sub">Tel:     ${CLINIC.phone}</div>
      <div class="clinic-sub">Email: ${CLINIC.email}</div>
    </div>
  </div>
  <div class="header-title" style="text-align:center;margin-bottom:14px;">
    <div class="invoice-label">Appointment Invoice</div>
  </div>
  <div class="meta">
    <div><div class="meta-label">Patient</div><div class="meta-value">${appt.patientName || ''}</div><div class="meta-sub">${appt.patientPhone || ''}</div></div>
    <div><div class="meta-label">Doctor</div><div class="meta-value">${appt.doctor?.designation || 'Dr.'} ${appt.doctor?.name || appt.doctorName || ''}</div><div class="meta-sub">${appt.doctor?.specialization || ''}</div></div>
    <div><div class="meta-label">Appointment</div><div class="meta-value">${appt.appointmentDate || ''}</div></div>
    ${queueCol}
  </div>
  <table class="items">
    <thead><tr><th>Service</th><th class="th-c"></th><th class="th-r">Amount</th></tr></thead>
    <tbody>${itemsRows}</tbody>
    <tfoot>
      <tr class="tfoot-sub"><td colspan="2">Sub Total</td><td style="font-family:'Courier New',monospace;font-size:12pt;text-align:right;">${fmt(subtotal)}</td></tr>
      <tr class="tfoot-paid"><td colspan="2">Total Paid</td><td style="font-family:'Courier New',monospace;font-size:12pt;text-align:right;">${fmt(paidTotal)}</td></tr>
      ${balanceLine}
    </tfoot>
  </table>
  ${payBlock}
  <div class="footer">${CLINIC.name} &bull; ${CLINIC.address} &bull; Tel: ${CLINIC.phone}<br>Computer-generated invoice &bull; No signature required</div>
  ${pdfBtn}
</div>
</body></html>`;
};

/** Open the invoice in a print-ready popup (professional B&W). */
export const printAppointmentInvoice = async (appt) => {
  const logo = await getLogoBase64();
  const html = buildAppointmentInvoiceHtml(appt, logo, 'print');
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
};

/** Open a popup that auto-triggers PDF download. */
export const downloadAppointmentInvoice = async (appt) => {
  const logo = await getLogoBase64();
  const html = buildAppointmentInvoiceHtml(appt, logo, 'download');
  const win = window.open('', '_blank', 'width=720,height=900');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};