import Appointment from '../models/Appointment.js';
import DoctorPayment from '../models/DoctorPayment.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Employee from '../models/Employee.js';
import SalaryPayment from '../models/SalaryPayment.js';
import Expense from '../models/Expense.js';
import ExtraIncome from '../models/ExtraIncome.js';
import WalkInBill from '../models/WalkInBill.js';
import doc from 'pdfkit';
import xl from 'excel4node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDFDocument = doc;

const getDateFilter = (startDate, endDate) => {
  const f = {};
  if (startDate) f.$gte = startDate;
  if (endDate) f.$lte = endDate;
  return Object.keys(f).length ? f : undefined;
};

/* ─────────────────────────────────────────────────────────────────────────────
   Split-aware helpers
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Returns true if `payment` (any split-payment block) used `method` either as
 * one of its splits OR as the legacy single paymentMethod field.
 * Used for filtering reports by payment method without dropping records that
 * partially used the requested method.
 */
const paymentUsesMethod = (payment, method) => {
  if (!payment || !method) return true;
  const splits = payment.paymentSplits || payment.splits;
  if (Array.isArray(splits) && splits.length > 0) {
    return splits.some(s => s.method === method);
  }
  return payment.paymentMethod === method;
};

/**
 * Reduce a payment block to per-method buckets.  Subtracts changeGiven
 * from the cash bucket (since change is always returned as cash) so the
 * totals reflect NET income per method.  The bucket may include
 * bank_transfer / cheque for finance flows.
 */
const splitToBuckets = (payment) => {
  const out = { cash: 0, card: 0, online: 0, bank_transfer: 0, cheque: 0 };
  if (!payment) return out;

  const splits = payment.paymentSplits || payment.splits;
  if (Array.isArray(splits) && splits.length > 0) {
    for (const s of splits) {
      if (out[s.method] !== undefined) out[s.method] += Number(s.amount || 0);
    }
  } else {
    const m = payment.paymentMethod;
    const amt = Number(payment.amount || payment.totalAmount || payment.totalPaid || 0);
    if (m && out[m] !== undefined && amt > 0) out[m] += amt;
  }

  const change = Number(payment.changeGiven || 0);
  if (change > 0) out.cash = Math.max(0, out.cash - change);
  return out;
};

/** Add two per-method bucket maps. */
const addBuckets = (a, b) => ({
  cash: (a.cash || 0) + (b.cash || 0),
  card: (a.card || 0) + (b.card || 0),
  online: (a.online || 0) + (b.online || 0),
  bank_transfer: (a.bank_transfer || 0) + (b.bank_transfer || 0),
  cheque: (a.cheque || 0) + (b.cheque || 0),
});
const emptyBuckets = () => ({ cash: 0, card: 0, online: 0, bank_transfer: 0, cheque: 0 });

/** Format splits as a short readable string for a report cell. */
const formatSplitsAsString = (payment) => {
  if (!payment) return '—';
  const splits = payment.paymentSplits || payment.splits;
  if (Array.isArray(splits) && splits.length > 1) {
    return splits.map(s => `${s.method} LKR ${Number(s.amount).toFixed(0)}`).join(' + ');
  }
  if (Array.isArray(splits) && splits.length === 1) return splits[0].method;
  return payment.paymentMethod || '—';
};

/* ─────────────────────────────────────────────────────────────────────────────
   Financial Summary
   ──────────────────────────────────────────────────────────────────────────── */
export const getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const dateFilter = getDateFilter(startDate, endDate);

    const apptFilter = { status: { $in: ['paid', 'completed'] } };
    if (dateFilter) apptFilter.appointmentDate = dateFilter;

    const appointments = await Appointment.find(apptFilter)
      .populate('doctor', 'name designation')
      .populate('service', 'name');

    // Filter by payment-method usage (splits OR legacy field)
    const filteredAppts = paymentMethod
      ? appointments.filter(a => paymentUsesMethod(a.receptionPayment, paymentMethod))
      : appointments;

    const appointmentRevenue = filteredAppts.reduce((s, a) => s + (a.price || 0), 0);

    // Pharmacy revenue from paid bills within medical appointments
    const pharmacyRevenue = appointments.reduce((s, a) => {
      const bills = (a.pharmacyBills || []).filter(b => {
        if (!b.isPaid) return false;
        if (paymentMethod && !paymentUsesMethod(b, paymentMethod)) return false;
        return true;
      });
      return s + bills.reduce((sum, b) => sum + b.totalAmount, 0);
    }, 0);

    // Walk-in bills (separate revenue stream)
    const walkInFilter = { isDeleted: false, isPaid: true };
    if (startDate || endDate) {
      walkInFilter.createdAt = {};
      if (startDate) walkInFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        walkInFilter.createdAt.$lte = end;
      }
    }
    const walkInBills = await WalkInBill.find(walkInFilter);
    const filteredWalkIns = paymentMethod
      ? walkInBills.filter(b => paymentUsesMethod(b, paymentMethod))
      : walkInBills;
    const walkInRevenue = filteredWalkIns.reduce((s, b) => s + (b.totalAmount || 0), 0);

    // Doctor payments
    const docPayFilter = { status: 'paid' };
    if (startDate || endDate) {
      docPayFilter.paidAt = {};
      if (startDate) docPayFilter.paidAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        docPayFilter.paidAt.$lte = end;
      }
    }
    const allDocPayments = await DoctorPayment.find(docPayFilter);
    const doctorPayments = paymentMethod
      ? allDocPayments.filter(p => paymentUsesMethod(p, paymentMethod))
      : allDocPayments;
    const doctorPaymentsTotal = doctorPayments.reduce((s, p) => s + p.amount, 0);

    // Salaries (single-method only)
    const salaryPayFilter = {};
    if (paymentMethod) salaryPayFilter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      salaryPayFilter.createdAt = {};
      if (startDate) salaryPayFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        salaryPayFilter.createdAt.$lte = end;
      }
    }
    const salaryPayments = await SalaryPayment.find(salaryPayFilter);
    const salaryTotal = salaryPayments.reduce((s, p) => s + p.amount, 0);

    // Expenses & Extra Income (split-aware)
    const dateOnly = {};
    if (dateFilter) dateOnly.date = dateFilter;
    const allExpenses = await Expense.find(dateOnly);
    const allExtraIncome = await ExtraIncome.find(dateOnly);
    const expensesData = paymentMethod ? allExpenses.filter(e => paymentUsesMethod(e, paymentMethod)) : allExpenses;
    const extraIncomeData = paymentMethod ? allExtraIncome.filter(i => paymentUsesMethod(i, paymentMethod)) : allExtraIncome;
    const totalExpenses = expensesData.reduce((s, e) => s + e.amount, 0);
    const totalExtraIncome = extraIncomeData.reduce((s, e) => s + e.amount, 0);

    const expectedDoctorFees = appointments.reduce((s, a) => {
      const baseFee = a.doctorFee || a.price || 0;
      const extraFees = (a.extraCharges || []).filter(c => c.isPaid).reduce((es, c) => es + (c.doctorFee || 0), 0);
      return s + baseFee + extraFees;
    }, 0);
    const pendingDoctorPayments = expectedDoctorFees - doctorPaymentsTotal;

    // Per-method aggregate buckets across ALL income sources
    let incomeByMethod = emptyBuckets();
    for (const a of appointments) {
      if (a.receptionPayment?.totalPaid)
        incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(a.receptionPayment));
      for (const b of (a.pharmacyBills || [])) {
        if (b.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(b));
      }
      for (const c of (a.extraCharges || [])) {
        if (c.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(c));
      }
    }
    for (const w of walkInBills) {
      incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(w));
    }

    // Per-method outflow buckets (doctor pay + salaries + expenses)
    let outflowByMethod = emptyBuckets();
    for (const p of allDocPayments) outflowByMethod = addBuckets(outflowByMethod, splitToBuckets(p));
    for (const e of allExpenses) outflowByMethod = addBuckets(outflowByMethod, splitToBuckets(e));
    for (const s of salaryPayments) {
      const m = s.paymentMethod || 'cash';
      if (outflowByMethod[m] !== undefined) outflowByMethod[m] += s.amount;
    }

    res.json({
      appointmentRevenue,
      pharmacyRevenue,
      walkInRevenue,
      doctorPaymentsTotal,
      pendingDoctorPayments: pendingDoctorPayments > 0 ? pendingDoctorPayments : 0,
      salaryTotal,
      totalExpenses,
      totalExtraIncome,
      netProfit: appointmentRevenue + pharmacyRevenue + walkInRevenue + totalExtraIncome
        - doctorPaymentsTotal - salaryTotal - totalExpenses,
      appointmentCount: filteredAppts.length,
      walkInCount: filteredWalkIns.length,
      incomeByMethod,
      outflowByMethod,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PDF Report
   ──────────────────────────────────────────────────────────────────────────── */
export const downloadPDFReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const apptFilter = { status: { $in: ['paid', 'completed'] } };
    if (startDate) apptFilter.appointmentDate = { $gte: startDate };
    if (endDate) apptFilter.appointmentDate = { ...apptFilter.appointmentDate, $lte: endDate };

    const allAppts = await Appointment.find(apptFilter)
      .populate('doctor', 'name designation')
      .populate('service', 'name');

    const appointments = paymentMethod
      ? allAppts.filter(a => paymentUsesMethod(a.receptionPayment, paymentMethod))
      : allAppts;

    const docPayFilter = { status: 'paid' };
    if (startDate || endDate) {
      docPayFilter.paidAt = {};
      if (startDate) docPayFilter.paidAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        docPayFilter.paidAt.$lte = end;
      }
    }
    const allDocPayments = await DoctorPayment.find(docPayFilter).populate('doctor', 'name designation');
    const docPayments = paymentMethod ? allDocPayments.filter(p => paymentUsesMethod(p, paymentMethod)) : allDocPayments;

    const salaryPayFilter = {};
    if (paymentMethod) salaryPayFilter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      salaryPayFilter.createdAt = {};
      if (startDate) salaryPayFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        salaryPayFilter.createdAt.$lte = end;
      }
    }
    const salaryPayments = await SalaryPayment.find(salaryPayFilter);

    // Walk-in bills
    const walkInFilter = { isDeleted: false, isPaid: true };
    if (startDate || endDate) {
      walkInFilter.createdAt = {};
      if (startDate) walkInFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        walkInFilter.createdAt.$lte = end;
      }
    }
    const allWalkIns = await WalkInBill.find(walkInFilter);
    const walkIns = paymentMethod ? allWalkIns.filter(b => paymentUsesMethod(b, paymentMethod)) : allWalkIns;

    const dateFilterForStr = {};
    if (startDate) dateFilterForStr.$gte = startDate;
    if (endDate) dateFilterForStr.$lte = endDate;
    const strFilter = {};
    if (dateFilterForStr.$gte || dateFilterForStr.$lte) strFilter.date = dateFilterForStr;

    const allExpenses = await Expense.find(strFilter);
    const allExtraIncome = await ExtraIncome.find(strFilter);
    const expensesData = paymentMethod ? allExpenses.filter(e => paymentUsesMethod(e, paymentMethod)) : allExpenses;
    const extraIncomeData = paymentMethod ? allExtraIncome.filter(i => paymentUsesMethod(i, paymentMethod)) : allExtraIncome;

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report.pdf`);
    doc.pipe(res);

    // Header
    let logoPath = path.join(__dirname, '../../frontend/public/logo.png');
    try {
      doc.image(logoPath, 50, 45, { width: 55 });
    } catch (e1) {
      try {
        logoPath = path.join(__dirname, '../logo.png');
        doc.image(logoPath, 50, 45, { width: 55 });
      } catch (e2) { console.error('Logo not found'); }
    }

    doc.fillColor('#1F2937').fontSize(22).font('Helvetica-Bold').text('Aayu Medi Care 24', 115, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('Excellence in Premium Healthcare Management', 115, 75);
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563EB').text('FINANCIAL AUDIT REPORT', 115, 90, { characterSpacing: 1 });
    doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#E5E7EB').lineWidth(1).stroke();
    doc.moveDown(2);

    doc.fillColor('#4B5563').fontSize(9).font('Helvetica')
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.text(`Period: ${startDate || 'All Time'} to ${endDate || 'All Time'}`, { align: 'right' });
    doc.text(`Payment Method: ${paymentMethod || 'All Methods'}`, { align: 'right' });
    doc.moveDown(2);

    // Executive Summary
    let apptRev = appointments.reduce((s, a) => s + (a.price || 0), 0);
    let pharmRev = appointments.reduce((s, a) => {
      const bills = (a.pharmacyBills || []).filter(b => b.isPaid && (!paymentMethod || paymentUsesMethod(b, paymentMethod)));
      return s + bills.reduce((sum, b) => sum + b.totalAmount, 0);
    }, 0);
    const walkInRev = walkIns.reduce((s, b) => s + (b.totalAmount || 0), 0);
    let doctorPaid = docPayments.reduce((s, p) => s + p.amount, 0);
    let salaryPaid = salaryPayments.reduce((s, p) => s + p.amount, 0);
    let externalExpenses = expensesData.reduce((s, e) => s + e.amount, 0);
    let externalIncome = extraIncomeData.reduce((s, e) => s + e.amount, 0);

    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text('Executive Summary', 50);
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.rect(50, tableTop, 500, 135).fill('#F9FAFB');
    doc.fillColor('#374151').fontSize(10).font('Helvetica-Bold');
    doc.text('Revenue (Appointments)', 70, tableTop + 12);
    doc.text('Revenue (Pharmacy)', 70, tableTop + 28);
    doc.text('Revenue (Walk-In Pharmacy)', 70, tableTop + 44);
    doc.text('Total Extra Income', 70, tableTop + 60);
    doc.text('Total Doctor Payouts', 70, tableTop + 76);
    doc.text('Total Staff Salaries', 70, tableTop + 92);
    doc.text('Total General Expenses', 70, tableTop + 108);

    doc.fillColor('#111827').font('Helvetica');
    doc.text(`LKR ${apptRev.toLocaleString()}`, 400, tableTop + 12, { align: 'right', width: 130 });
    doc.text(`LKR ${pharmRev.toLocaleString()}`, 400, tableTop + 28, { align: 'right', width: 130 });
    doc.text(`LKR ${walkInRev.toLocaleString()}`, 400, tableTop + 44, { align: 'right', width: 130 });
    doc.text(`LKR ${externalIncome.toLocaleString()}`, 400, tableTop + 60, { align: 'right', width: 130 });
    doc.text(`LKR ${doctorPaid.toLocaleString()}`, 400, tableTop + 76, { align: 'right', width: 130 });
    doc.text(`LKR ${salaryPaid.toLocaleString()}`, 400, tableTop + 92, { align: 'right', width: 130 });
    doc.text(`LKR ${externalExpenses.toLocaleString()}`, 400, tableTop + 108, { align: 'right', width: 130 });

    doc.moveDown(5);
    const netIncome = apptRev + pharmRev + walkInRev + externalIncome - doctorPaid - salaryPaid - externalExpenses;
    doc.fillColor(netIncome >= 0 ? '#059669' : '#DC2626').fontSize(16).font('Helvetica-Bold')
      .text(`Net Income: LKR ${netIncome.toLocaleString()}`, { align: 'right' });
    doc.moveDown(1);

    // Per-method breakdown
    let incomeByMethod = emptyBuckets();
    for (const a of appointments) {
      if (a.receptionPayment?.totalPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(a.receptionPayment));
      for (const b of (a.pharmacyBills || [])) if (b.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(b));
      for (const c of (a.extraCharges || [])) if (c.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(c));
    }
    for (const w of walkIns) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(w));

    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Income by Payment Method', 50);
    doc.moveTo(50, doc.y + 2).lineTo(220, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1);
    let yMethod = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Method', 50, yMethod);
    doc.text('Net Amount (LKR)', 400, yMethod, { align: 'right', width: 150 });
    yMethod += 14;
    doc.font('Helvetica').fillColor('#111827').fontSize(9);
    Object.entries(incomeByMethod).filter(([_, v]) => v > 0).forEach(([m, v]) => {
      doc.text(m.replace('_', ' ').toUpperCase(), 50, yMethod);
      doc.text(`LKR ${v.toLocaleString()}`, 400, yMethod, { align: 'right', width: 150 });
      yMethod += 12;
    });
    doc.y = yMethod;
    doc.moveDown(2);

    // Appointments table
    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold').text('Appointment Payments', 50);
    doc.moveTo(50, doc.y + 2).lineTo(220, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    let y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Date', 50, y); doc.text('Patient', 110, y); doc.text('Doctor', 230, y);
    doc.text('Service', 320, y); doc.text('Amount', 430, y); doc.text('Method(s)', 480, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    appointments.forEach(a => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(String(a.appointmentDate || '-'), 50, y);
      doc.text(String(a.patientName || '-').substring(0, 18), 110, y);
      doc.text(`${a.doctor?.designation || 'Dr.'} ${a.doctor?.name || a.doctorName || '—'}`.substring(0, 20), 230, y);
      doc.text(String(a.service?.name || a.serviceName || '—').substring(0, 18), 320, y);
      doc.text(`LKR ${a.price}`, 430, y);
      doc.text(formatSplitsAsString(a.receptionPayment).substring(0, 25), 480, y);
      y += 12;
    });
    doc.moveDown(3);
    y = doc.y;

    // Pharmacy bills (linked)
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Pharmacy Revenue (Linked to Appointments)', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(280, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Date', 50, y); doc.text('Patient', 130, y); doc.text('Bill #', 270, y);
    doc.text('Amount', 350, y); doc.text('Method(s)', 430, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    appointments.forEach(a => {
      (a.pharmacyBills || []).filter(b => b.isPaid && (!paymentMethod || paymentUsesMethod(b, paymentMethod)))
        .forEach(b => {
          if (y > 730) { doc.addPage(); y = 50; }
          doc.text(String(b.paidAt?.toISOString().split('T')[0] || a.appointmentDate || '-'), 50, y);
          doc.text(String(a.patientName || '-').substring(0, 25), 130, y);
          doc.text(String(b.billNumber || '-'), 270, y);
          doc.text(`LKR ${b.totalAmount}`, 350, y);
          doc.text(formatSplitsAsString(b).substring(0, 30), 430, y);
          y += 12;
        });
    });
    doc.moveDown(3);
    y = doc.y;

    // Walk-in pharmacy bills
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Walk-In Pharmacy Bills', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(180, doc.y + 2).strokeColor('#059669').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Date', 50, y); doc.text('Bill #', 130, y); doc.text('Customer', 200, y);
    doc.text('Amount', 380, y); doc.text('Method(s)', 460, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    walkIns.forEach(b => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(String(b.createdAt?.toISOString().split('T')[0] || '-'), 50, y);
      doc.text(`WI-${String(b.billNumber).padStart(4, '0')}`, 130, y);
      doc.text(String(b.customerName || '-').substring(0, 30), 200, y);
      doc.text(`LKR ${b.totalAmount}`, 380, y);
      doc.text(formatSplitsAsString(b).substring(0, 25), 460, y);
      y += 12;
    });
    doc.moveDown(3);
    y = doc.y;

    // Doctor payouts
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Doctor Payout History', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(180, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Doctor', 50, y); doc.text('Amount', 200, y); doc.text('Status', 280, y);
    doc.text('Method(s)', 350, y); doc.text('Paid Date', 480, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    docPayments.forEach(p => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(`${p.doctor?.designation || 'Dr.'} ${p.doctor?.name || p.doctorName || '—'}`.substring(0, 30), 50, y);
      doc.text(`LKR ${p.amount}`, 200, y);
      doc.text(String(p.status || '').toUpperCase(), 280, y);
      doc.text(formatSplitsAsString(p).substring(0, 25), 350, y);
      doc.text(p.paidAt?.toISOString().split('T')[0] || '—', 480, y);
      y += 12;
    });
    doc.moveDown(3);
    y = doc.y;

    // Salaries
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Staff Salary Payouts', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(170, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Employee', 50, y); doc.text('Month', 200, y); doc.text('Amount', 300, y);
    doc.text('Method', 400, y); doc.text('Paid Date', 480, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    salaryPayments.forEach(p => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(`${p.employeeName} (${p.employeeDesignation || ''})`.substring(0, 30), 50, y);
      doc.text(p.month || '-', 200, y);
      doc.text(`LKR ${p.amount}`, 300, y);
      doc.text(p.paymentMethod || 'cash', 400, y);
      doc.text(p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '—', 480, y);
      y += 12;
    });
    doc.moveDown(3);
    y = doc.y;

    // Expenses
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('General Expenses', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(170, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Date', 50, y); doc.text('Title', 130, y); doc.text('Category', 270, y);
    doc.text('Amount', 360, y); doc.text('Method(s)', 440, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    expensesData.forEach(e => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(e.date || '-', 50, y);
      doc.text(String(e.title || '').substring(0, 25), 130, y);
      doc.text(String(e.category || '-').substring(0, 18), 270, y);
      doc.text(`LKR ${e.amount}`, 360, y);
      doc.text(formatSplitsAsString(e).substring(0, 25), 440, y);
      y += 12;
    });
    doc.moveDown(3);
    y = doc.y;

    // Extra Income
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text('Extra Income', 50, y);
    doc.moveTo(50, doc.y + 2).lineTo(140, doc.y + 2).strokeColor('#2563EB').lineWidth(2).stroke();
    doc.moveDown(1.5);
    y = doc.y;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#6B7280');
    doc.text('Date', 50, y); doc.text('Title', 130, y); doc.text('Source', 270, y);
    doc.text('Amount', 360, y); doc.text('Method(s)', 440, y);
    doc.moveTo(50, y + 12).lineTo(550, y + 12).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
    y += 18;
    doc.font('Helvetica').fontSize(8).fillColor('#111827');
    extraIncomeData.forEach(inc => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.text(inc.date || '-', 50, y);
      doc.text(String(inc.title || '').substring(0, 25), 130, y);
      doc.text(String(inc.source || '-').substring(0, 18), 270, y);
      doc.text(`LKR ${inc.amount}`, 360, y);
      doc.text(formatSplitsAsString(inc).substring(0, 25), 440, y);
      y += 12;
    });

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < (range.start + range.count); i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#9CA3AF').text(`Aayu Medi Care 24 - Confidential Financial Report | Page ${i + 1} of ${range.count}`, 50, 780, { align: 'center' });
    }
    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Excel Report
   ──────────────────────────────────────────────────────────────────────────── */
export const downloadExcelReport = async (req, res) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    const apptFilter = { status: { $in: ['paid', 'completed'] } };
    if (startDate) apptFilter.appointmentDate = { $gte: startDate };
    if (endDate) apptFilter.appointmentDate = { ...apptFilter.appointmentDate, $lte: endDate };

    const allAppts = await Appointment.find(apptFilter).populate('doctor', 'name designation').populate('service', 'name');
    const appointments = paymentMethod
      ? allAppts.filter(a => paymentUsesMethod(a.receptionPayment, paymentMethod))
      : allAppts;

    const docPayFilter = { status: 'paid' };
    if (startDate || endDate) {
      docPayFilter.paidAt = {};
      if (startDate) docPayFilter.paidAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        docPayFilter.paidAt.$lte = end;
      }
    }
    const allDocPayments = await DoctorPayment.find(docPayFilter).populate('doctor', 'name designation');
    const docPayments = paymentMethod ? allDocPayments.filter(p => paymentUsesMethod(p, paymentMethod)) : allDocPayments;

    const salaryPayFilter = {};
    if (paymentMethod) salaryPayFilter.paymentMethod = paymentMethod;
    if (startDate || endDate) {
      salaryPayFilter.createdAt = {};
      if (startDate) salaryPayFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        salaryPayFilter.createdAt.$lte = end;
      }
    }
    const salaryPayments = await SalaryPayment.find(salaryPayFilter);

    const walkInFilter = { isDeleted: false, isPaid: true };
    if (startDate || endDate) {
      walkInFilter.createdAt = {};
      if (startDate) walkInFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        walkInFilter.createdAt.$lte = end;
      }
    }
    const allWalkIns = await WalkInBill.find(walkInFilter);
    const walkIns = paymentMethod ? allWalkIns.filter(b => paymentUsesMethod(b, paymentMethod)) : allWalkIns;

    const dateFilterForStr = {};
    if (startDate) dateFilterForStr.$gte = startDate;
    if (endDate) dateFilterForStr.$lte = endDate;
    const strFilter = {};
    if (dateFilterForStr.$gte || dateFilterForStr.$lte) strFilter.date = dateFilterForStr;

    const allExpenses = await Expense.find(strFilter);
    const allExtraIncome = await ExtraIncome.find(strFilter);
    const expensesData = paymentMethod ? allExpenses.filter(e => paymentUsesMethod(e, paymentMethod)) : allExpenses;
    const extraIncomeData = paymentMethod ? allExtraIncome.filter(i => paymentUsesMethod(i, paymentMethod)) : allExtraIncome;

    const wb = new xl.Workbook();
    const styles = {
      header: wb.createStyle({ font: { color: '#FFFFFF', bold: true, size: 12 }, fill: { type: 'pattern', patternType: 'solid', fgColor: '#2563EB' } }),
      bold: wb.createStyle({ font: { bold: true } }),
    };

    // Sheet 1: Appointments
    const ws1 = wb.addWorksheet('Appointments');
    ['Date', 'Patient', 'Doctor', 'Service', 'Amount', 'Status', 'Method(s)', 'Tendered', 'Change']
      .forEach((h, i) => { ws1.cell(1, i + 1).string(h).style(styles.header); });
    appointments.forEach((a, i) => {
      const r = i + 2;
      const rp = a.receptionPayment || {};
      ws1.cell(r, 1).string(a.appointmentDate || '');
      ws1.cell(r, 2).string(a.patientName || '');
      ws1.cell(r, 3).string(a.doctor?.name || a.doctorName || '');
      ws1.cell(r, 4).string(a.service?.name || a.serviceName || '');
      ws1.cell(r, 5).number(a.price || 0);
      ws1.cell(r, 6).string(a.status || '');
      ws1.cell(r, 7).string(formatSplitsAsString(rp));
      ws1.cell(r, 8).number(Number(rp.totalTendered || rp.cashTendered || rp.totalPaid || a.price || 0));
      ws1.cell(r, 9).number(Number(rp.changeGiven || 0));
    });

    // Sheet 2: Doctor Payments
    const ws2 = wb.addWorksheet('Doctor Payments');
    ['Doctor', 'Amount', 'Status', 'Method(s)', 'Tendered', 'Change', 'Period Start', 'Period End', 'Paid At']
      .forEach((h, i) => { ws2.cell(1, i + 1).string(h).style(styles.header); });
    docPayments.forEach((p, i) => {
      const r = i + 2;
      ws2.cell(r, 1).string(p.doctor?.name || p.doctorName || '');
      ws2.cell(r, 2).number(p.amount);
      ws2.cell(r, 3).string(p.status || '');
      ws2.cell(r, 4).string(formatSplitsAsString(p));
      ws2.cell(r, 5).number(Number(p.totalTendered || p.cashTendered || p.amount || 0));
      ws2.cell(r, 6).number(Number(p.changeGiven || 0));
      ws2.cell(r, 7).string(p.periodStart?.toISOString().split('T')[0] || '');
      ws2.cell(r, 8).string(p.periodEnd?.toISOString().split('T')[0] || '');
      ws2.cell(r, 9).string(p.paidAt?.toISOString().split('T')[0] || '');
    });

    // Sheet 3: Pharmacy bills (linked to appointments)
    const ws3 = wb.addWorksheet('Pharmacy');
    ['Date', 'Patient', 'Bill #', 'Amount', 'Method(s)', 'Tendered', 'Change']
      .forEach((h, i) => { ws3.cell(1, i + 1).string(h).style(styles.header); });
    let pharmRow = 2;
    appointments.forEach(a => {
      (a.pharmacyBills || []).filter(b => b.isPaid && (!paymentMethod || paymentUsesMethod(b, paymentMethod)))
        .forEach(b => {
          ws3.cell(pharmRow, 1).string(b.paidAt?.toISOString().split('T')[0] || a.appointmentDate || '');
          ws3.cell(pharmRow, 2).string(a.patientName || '');
          ws3.cell(pharmRow, 3).number(b.billNumber || 0);
          ws3.cell(pharmRow, 4).number(b.totalAmount);
          ws3.cell(pharmRow, 5).string(formatSplitsAsString(b));
          ws3.cell(pharmRow, 6).number(Number(b.totalTendered || b.cashTendered || b.totalAmount || 0));
          ws3.cell(pharmRow, 7).number(Number(b.changeGiven || 0));
          pharmRow++;
        });
    });

    // Sheet 4: Walk-In Bills
    const ws4 = wb.addWorksheet('Walk-In Bills');
    ['Date', 'Bill #', 'Customer', 'Phone', 'Amount', 'Method(s)', 'Tendered', 'Change']
      .forEach((h, i) => { ws4.cell(1, i + 1).string(h).style(styles.header); });
    walkIns.forEach((b, i) => {
      const r = i + 2;
      ws4.cell(r, 1).string(b.createdAt?.toISOString().split('T')[0] || '');
      ws4.cell(r, 2).string(`WI-${String(b.billNumber).padStart(4, '0')}`);
      ws4.cell(r, 3).string(b.customerName || '');
      ws4.cell(r, 4).string(b.customerPhone || '');
      ws4.cell(r, 5).number(b.totalAmount);
      ws4.cell(r, 6).string(formatSplitsAsString(b));
      ws4.cell(r, 7).number(Number(b.totalTendered || b.cashTendered || b.totalAmount || 0));
      ws4.cell(r, 8).number(Number(b.changeGiven || 0));
    });

    // Sheet 5: Salaries
    const ws5 = wb.addWorksheet('Salaries');
    ['Employee', 'Designation', 'Month', 'Amount', 'Method', 'Paid At']
      .forEach((h, i) => { ws5.cell(1, i + 1).string(h).style(styles.header); });
    salaryPayments.forEach((p, i) => {
      const r = i + 2;
      ws5.cell(r, 1).string(p.employeeName || '');
      ws5.cell(r, 2).string(p.employeeDesignation || '');
      ws5.cell(r, 3).string(p.month || '');
      ws5.cell(r, 4).number(p.amount);
      ws5.cell(r, 5).string(p.paymentMethod || 'cash');
      ws5.cell(r, 6).string(p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '');
    });

    // Sheet 6: Expenses
    const ws6 = wb.addWorksheet('Expenses');
    ['Date', 'Title', 'Category', 'Description', 'Amount', 'Method(s)']
      .forEach((h, i) => { ws6.cell(1, i + 1).string(h).style(styles.header); });
    expensesData.forEach((e, i) => {
      const r = i + 2;
      ws6.cell(r, 1).string(e.date || '');
      ws6.cell(r, 2).string(e.title || '');
      ws6.cell(r, 3).string(e.category || '');
      ws6.cell(r, 4).string(e.description || '');
      ws6.cell(r, 5).number(e.amount);
      ws6.cell(r, 6).string(formatSplitsAsString(e));
    });

    // Sheet 7: Extra Income
    const ws7 = wb.addWorksheet('Extra Income');
    ['Date', 'Title', 'Source', 'Description', 'Amount', 'Method(s)']
      .forEach((h, i) => { ws7.cell(1, i + 1).string(h).style(styles.header); });
    extraIncomeData.forEach((inc, i) => {
      const r = i + 2;
      ws7.cell(r, 1).string(inc.date || '');
      ws7.cell(r, 2).string(inc.title || '');
      ws7.cell(r, 3).string(inc.source || '');
      ws7.cell(r, 4).string(inc.description || '');
      ws7.cell(r, 5).number(inc.amount);
      ws7.cell(r, 6).string(formatSplitsAsString(inc));
    });

    // Sheet 8: Method Summary
    const ws8 = wb.addWorksheet('Method Summary');
    let incomeByMethod = emptyBuckets();
    for (const a of appointments) {
      if (a.receptionPayment?.totalPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(a.receptionPayment));
      for (const b of (a.pharmacyBills || [])) if (b.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(b));
      for (const c of (a.extraCharges || [])) if (c.isPaid) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(c));
    }
    for (const w of walkIns) incomeByMethod = addBuckets(incomeByMethod, splitToBuckets(w));

    ['Method', 'Net Income (LKR)'].forEach((h, i) => { ws8.cell(1, i + 1).string(h).style(styles.header); });
    Object.entries(incomeByMethod).forEach(([m, v], i) => {
      ws8.cell(i + 2, 1).string(m.replace('_', ' ').toUpperCase());
      ws8.cell(i + 2, 2).number(Number(v.toFixed(2)));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=financial-report.xlsx`);
    wb.write('report.xlsx', res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Custom Report (Excel - per-area breakdown)
   ──────────────────────────────────────────────────────────────────────────── */
export const downloadCustomReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate) dateQuery.$gte = startDate;
    if (endDate) dateQuery.$lte = endDate;
    const filterByDate = Object.keys(dateQuery).length ? { date: dateQuery } : {};

    const createdAtQuery = {};
    if (startDate || endDate) {
      createdAtQuery.createdAt = {};
      if (startDate) createdAtQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        createdAtQuery.createdAt.$lte = end;
      }
    }

    const [appointments, doctors, employees, salaries, expenses, extraIncome, walkInBills] = await Promise.all([
      Appointment.find(Object.keys(dateQuery).length ? { appointmentDate: dateQuery } : {}).populate('doctor', 'name designation').populate('service', 'name'),
      DoctorProfile.find().populate('services.service', 'name'),
      Employee.find().populate('user', 'name phone email'),
      SalaryPayment.find(createdAtQuery.createdAt ? { createdAt: createdAtQuery.createdAt } : {}),
      Expense.find(filterByDate),
      ExtraIncome.find(filterByDate),
      WalkInBill.find({
        isDeleted: false,
        ...(createdAtQuery.createdAt ? { createdAt: createdAtQuery.createdAt } : {}),
      }),
    ]);

    const wb = new xl.Workbook();
    const headerStyle = wb.createStyle({ font: { bold: true, size: 12, color: '#FFFFFF' }, fill: { type: 'pattern', patternType: 'solid', fgColor: '#2563EB' } });

    // Pharmacy bills (linked) — line items
    const wsPharm = wb.addWorksheet('Pharmacy Report');
    ['Date', 'Bill #', 'Patient', 'Medicine', 'Quantity', 'Unit Price', 'Total', 'Doctor', 'Method(s)']
      .forEach((h, i) => wsPharm.cell(1, i + 1).string(h).style(headerStyle));
    let pharmRow = 2;
    appointments.forEach(a => {
      (a.pharmacyBills || []).forEach(b => {
        (b.medicines || []).forEach(m => {
          wsPharm.cell(pharmRow, 1).string(String((b.paidAt || b.billedAt || new Date()).toISOString().split('T')[0]));
          wsPharm.cell(pharmRow, 2).number(b.billNumber || 0);
          wsPharm.cell(pharmRow, 3).string(String(a.patientName || '-'));
          wsPharm.cell(pharmRow, 4).string(String(m.name || '-'));
          wsPharm.cell(pharmRow, 5).number(m.quantity || 0);
          wsPharm.cell(pharmRow, 6).number(m.price || 0);
          wsPharm.cell(pharmRow, 7).number((m.price || 0) * (m.quantity || 0));
          wsPharm.cell(pharmRow, 8).string(String(a.doctorName || a.doctor?.name || '-'));
          wsPharm.cell(pharmRow, 9).string(formatSplitsAsString(b));
          pharmRow++;
        });
      });
    });

    // Walk-in bills — line items
    const wsWalk = wb.addWorksheet('Walk-In Pharmacy');
    ['Date', 'Bill #', 'Customer', 'Phone', 'Medicine', 'Quantity', 'Unit Price', 'Total', 'Bill Total', 'Method(s)', 'Cash Given', 'Change']
      .forEach((h, i) => wsWalk.cell(1, i + 1).string(h).style(headerStyle));
    let walkRow = 2;
    walkInBills.forEach(b => {
      (b.medicines || []).forEach(m => {
        wsWalk.cell(walkRow, 1).string(String(b.createdAt?.toISOString().split('T')[0] || '-'));
        wsWalk.cell(walkRow, 2).string(`WI-${String(b.billNumber).padStart(4, '0')}`);
        wsWalk.cell(walkRow, 3).string(String(b.customerName || '-'));
        wsWalk.cell(walkRow, 4).string(String(b.customerPhone || '-'));
        wsWalk.cell(walkRow, 5).string(String(m.name || '-'));
        wsWalk.cell(walkRow, 6).number(m.quantity || 0);
        wsWalk.cell(walkRow, 7).number(m.price || 0);
        wsWalk.cell(walkRow, 8).number((m.price || 0) * (m.quantity || 0));
        wsWalk.cell(walkRow, 9).number(b.totalAmount || 0);
        wsWalk.cell(walkRow, 10).string(formatSplitsAsString(b));
        wsWalk.cell(walkRow, 11).number(Number(b.totalTendered || b.cashTendered || b.totalAmount || 0));
        wsWalk.cell(walkRow, 12).number(Number(b.changeGiven || 0));
        walkRow++;
      });
    });

    // Walk-in bills — summary (one row per bill)
    const wsWalkSum = wb.addWorksheet('Walk-In Summary');
    ['Date', 'Bill #', 'Customer', 'Phone', 'Items', 'Total', 'Status', 'Method(s)', 'Cash Given', 'Change']
      .forEach((h, i) => wsWalkSum.cell(1, i + 1).string(h).style(headerStyle));
    walkInBills.forEach((b, i) => {
      const r = i + 2;
      wsWalkSum.cell(r, 1).string(String(b.createdAt?.toISOString().split('T')[0] || '-'));
      wsWalkSum.cell(r, 2).string(`WI-${String(b.billNumber).padStart(4, '0')}`);
      wsWalkSum.cell(r, 3).string(String(b.customerName || '-'));
      wsWalkSum.cell(r, 4).string(String(b.customerPhone || '-'));
      wsWalkSum.cell(r, 5).number(b.medicines?.length || 0);
      wsWalkSum.cell(r, 6).number(b.totalAmount || 0);
      wsWalkSum.cell(r, 7).string(b.isPaid ? 'PAID' : 'PENDING');
      wsWalkSum.cell(r, 8).string(formatSplitsAsString(b));
      wsWalkSum.cell(r, 9).number(Number(b.totalTendered || b.cashTendered || 0));
      wsWalkSum.cell(r, 10).number(Number(b.changeGiven || 0));
    });

    const wsAppt = wb.addWorksheet('Appointment Report');
    ['Date', 'Patient Name', 'Phone', 'Doctor', 'Service', 'Price', 'Status', 'Method(s)', 'Cash Given', 'Change']
      .forEach((h, i) => wsAppt.cell(1, i + 1).string(h).style(headerStyle));
    appointments.forEach((a, i) => {
      const r = i + 2;
      const rp = a.receptionPayment || {};
      wsAppt.cell(r, 1).string(String(a.appointmentDate || '-'));
      wsAppt.cell(r, 2).string(String(a.patientName || '-'));
      wsAppt.cell(r, 3).string(String(a.patientPhone || '-'));
      wsAppt.cell(r, 4).string(String(a.doctorName || a.doctor?.name || '-'));
      wsAppt.cell(r, 5).string(String(a.serviceName || a.service?.name || '-'));
      wsAppt.cell(r, 6).number(a.price || 0);
      wsAppt.cell(r, 7).string(String(a.status || '-'));
      wsAppt.cell(r, 8).string(formatSplitsAsString(rp));
      wsAppt.cell(r, 9).number(Number(rp.totalTendered || rp.cashTendered || 0));
      wsAppt.cell(r, 10).number(Number(rp.changeGiven || 0));
    });

    const wsDoc = wb.addWorksheet('Doctor Report');
    ['Doctor Name', 'Specialization', 'Phone', 'Service', 'Total Price', 'Doctor Fee']
      .forEach((h, i) => wsDoc.cell(1, i + 1).string(h).style(headerStyle));
    let docRow = 2;
    doctors.forEach(d => {
      (d.services || []).forEach(s => {
        wsDoc.cell(docRow, 1).string(String(d.name || '-'));
        wsDoc.cell(docRow, 2).string(String(d.specialization || '-'));
        wsDoc.cell(docRow, 3).string(String(d.phone || '-'));
        wsDoc.cell(docRow, 4).string(String(s.service?.name || '-'));
        wsDoc.cell(docRow, 5).number(s.price || 0);
        wsDoc.cell(docRow, 6).number(s.doctorFee || 0);
        docRow++;
      });
    });

    const wsEmp = wb.addWorksheet('Employee Report');
    ['Name', 'Phone', 'Email', 'Designation', 'Joined Date', 'Basic Salary']
      .forEach((h, i) => wsEmp.cell(1, i + 1).string(h).style(headerStyle));
    employees.forEach((e, i) => {
      const r = i + 2;
      const name = e.hasAccount ? (e.user?.name) : e.name;
      const phone = e.hasAccount ? (e.user?.phone) : e.phone;
      const email = e.hasAccount ? (e.user?.email) : e.email;
      wsEmp.cell(r, 1).string(String(name || '-'));
      wsEmp.cell(r, 2).string(String(phone || '-'));
      wsEmp.cell(r, 3).string(String(email || '-'));
      wsEmp.cell(r, 4).string(String(e.designation || '-'));
      wsEmp.cell(r, 5).string(String(e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-'));
      wsEmp.cell(r, 6).number(e.monthlySalary || 0);
    });

    const wsSal = wb.addWorksheet('Salary Payments');
    ['Emp Name', 'Month', 'Base', 'Bonus', 'Deduction', 'Total Paid', 'Date Paid', 'Method']
      .forEach((h, i) => wsSal.cell(1, i + 1).string(h).style(headerStyle));
    salaries.forEach((s, i) => {
      const r = i + 2;
      wsSal.cell(r, 1).string(String(s.employeeName || '-'));
      wsSal.cell(r, 2).string(String(s.month || '-'));
      wsSal.cell(r, 3).number(s.basicSalary || 0);
      wsSal.cell(r, 4).number(s.bonus || 0);
      wsSal.cell(r, 5).number(s.deduction || 0);
      wsSal.cell(r, 6).number(s.amount || 0);
      wsSal.cell(r, 7).string(String(s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '-'));
      wsSal.cell(r, 8).string(String(s.paymentMethod || 'cash'));
    });

    const wsExp = wb.addWorksheet('Expenses');
    ['Date', 'Title', 'Category', 'Description', 'Amount', 'Method(s)']
      .forEach((h, i) => wsExp.cell(1, i + 1).string(h).style(headerStyle));
    expenses.forEach((e, i) => {
      const r = i + 2;
      wsExp.cell(r, 1).string(String(e.date || '-'));
      wsExp.cell(r, 2).string(String(e.title || '-'));
      wsExp.cell(r, 3).string(String(e.category || '-'));
      wsExp.cell(r, 4).string(String(e.description || ''));
      wsExp.cell(r, 5).number(e.amount || 0);
      wsExp.cell(r, 6).string(formatSplitsAsString(e));
    });

    const wsInc = wb.addWorksheet('Extra Income');
    ['Date', 'Title', 'Source', 'Description', 'Amount', 'Method(s)']
      .forEach((h, i) => wsInc.cell(1, i + 1).string(h).style(headerStyle));
    extraIncome.forEach((inc, i) => {
      const r = i + 2;
      wsInc.cell(r, 1).string(String(inc.date || '-'));
      wsInc.cell(r, 2).string(String(inc.title || '-'));
      wsInc.cell(r, 3).string(String(inc.source || '-'));
      wsInc.cell(r, 4).string(String(inc.description || ''));
      wsInc.cell(r, 5).number(inc.amount || 0);
      wsInc.cell(r, 6).string(formatSplitsAsString(inc));
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=custom-management-report.xlsx');
    wb.write('CustomReport.xlsx', res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Categorized PDF (per area)
   ──────────────────────────────────────────────────────────────────────────── */
export const downloadCategorizedPDF = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const dateQuery = {};
    if (startDate) dateQuery.$gte = startDate;
    if (endDate) dateQuery.$lte = endDate;

    const createdAtRange = {};
    if (startDate || endDate) {
      if (startDate) createdAtRange.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate); end.setUTCHours(23, 59, 59, 999);
        createdAtRange.$lte = end;
      }
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
    doc.pipe(res);

    let logoPath = path.join(__dirname, '../../frontend/public/logo.png');
    try { doc.image(logoPath, 50, 45, { width: 55 }); } catch (e) {
      try { logoPath = path.join(__dirname, '../logo.png'); doc.image(logoPath, 50, 45, { width: 55 }); } catch (e2) { }
    }
    doc.fillColor('#1F2937').fontSize(20).font('Helvetica-Bold').text('Aayu Medi Care 24', 115, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text('Premium Healthcare Management System', 115, 72);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#2563EB').text(`${type.toUpperCase()} REPORT`, 115, 87);
    doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#E5E7EB').lineWidth(1).stroke();
    doc.moveDown(3);
    let y = 140;

    switch (type) {
      case 'pharmacy': {
        const apptsPharm = await Appointment.find({ appointmentDate: dateQuery }).populate('doctor', 'name designation');
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Bill #', 100, y); doc.text('Patient', 145, y);
        doc.text('Medicine', 250, y); doc.text('Qty', 380, y);
        doc.text('Amount', 410, y); doc.text('Method(s)', 470, y);
        y += 15;
        apptsPharm.forEach(a => {
          (a.pharmacyBills || []).forEach(b => {
            (b.medicines || []).forEach(m => {
              if (y > 750) { doc.addPage(); y = 50; }
              doc.font('Helvetica').fontSize(8).text(String(a.appointmentDate), 50, y);
              doc.text(String(b.billNumber || 1), 100, y);
              doc.text(String(a.patientName || '-').substring(0, 18), 145, y);
              doc.text(String(m.name || '-').substring(0, 22), 250, y);
              doc.text(String(m.quantity || 0), 380, y);
              doc.text(String((m.price || 0) * (m.quantity || 1)), 410, y);
              doc.text(formatSplitsAsString(b).substring(0, 20), 470, y);
              y += 12;
            });
          });
        });
        break;
      }

      case 'walkin': {
        const filter = { isDeleted: false };
        if (Object.keys(createdAtRange).length) filter.createdAt = createdAtRange;
        const wks = await WalkInBill.find(filter);
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Bill #', 110, y); doc.text('Customer', 170, y);
        doc.text('Total', 320, y); doc.text('Method(s)', 380, y);
        doc.text('Cash Given', 470, y); doc.text('Change', 525, y);
        y += 15;
        wks.forEach(b => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font('Helvetica').fontSize(8).text(String(b.createdAt?.toISOString().split('T')[0] || '-'), 50, y);
          doc.text(`WI-${String(b.billNumber).padStart(4, '0')}`, 110, y);
          doc.text(String(b.customerName || '-').substring(0, 25), 170, y);
          doc.text(String(b.totalAmount || 0), 320, y);
          doc.text(formatSplitsAsString(b).substring(0, 16), 380, y);
          doc.text(String(Number(b.totalTendered || b.cashTendered || 0).toFixed(0)), 470, y);
          doc.text(String(Number(b.changeGiven || 0).toFixed(0)), 525, y);
          y += 12;
        });
        break;
      }

      case 'appointments': {
        const apptsRec = await Appointment.find({ appointmentDate: dateQuery }).populate('doctor', 'name designation').populate('service', 'name');
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 45, y);
        doc.text('Patient', 100, y); doc.text('Doctor', 200, y);
        doc.text('Service', 300, y); doc.text('Amt', 410, y);
        doc.text('Status', 445, y); doc.text('Method(s)', 490, y);
        y += 15;
        apptsRec.forEach(a => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font('Helvetica').fontSize(8).text(String(a.appointmentDate || '-'), 45, y);
          doc.text(String(a.patientName || '-').substring(0, 16), 100, y);
          doc.text(String(a.doctorName || a.doctor?.name || '-').substring(0, 16), 200, y);
          doc.text(String(a.serviceName || a.service?.name || '-').substring(0, 18), 300, y);
          doc.text(String(a.price || 0), 410, y);
          doc.text(String(a.status || '-').substring(0, 8), 445, y);
          doc.text(formatSplitsAsString(a.receptionPayment).substring(0, 16), 490, y);
          y += 12;
        });
        break;
      }

      case 'doctors': {
        const docs = await DoctorProfile.find().populate('services.service', 'name');
        doc.fontSize(10).font('Helvetica-Bold').text('Doctor', 50, y);
        doc.text('Phone', 200, y); doc.text('Service', 300, y);
        doc.text('Price', 450, y); doc.text('Fee', 510, y);
        y += 15;
        docs.forEach(d => {
          (d.services || []).forEach(s => {
            if (y > 750) { doc.addPage(); y = 50; }
            doc.font('Helvetica').fontSize(8).text(String(d.name || '-'), 50, y);
            doc.text(String(d.phone || '-'), 200, y);
            doc.text(String(s.service?.name || '-'), 300, y);
            doc.text(String(s.price || 0), 450, y);
            doc.text(String(s.doctorFee || 0), 510, y);
            y += 12;
          });
        });
        break;
      }

      case 'employees': {
        const empsList = await Employee.find().populate('user', 'name phone email');
        doc.fontSize(10).font('Helvetica-Bold').text('Name', 45, y);
        doc.text('Email/Phone', 135, y); doc.text('Designation', 290, y);
        doc.text('Joined', 410, y); doc.text('Salary', 485, y);
        y += 15;
        empsList.forEach(e => {
          if (y > 750) { doc.addPage(); y = 50; }
          const name = e.hasAccount ? (e.user?.name) : e.name;
          const contact = e.hasAccount ? (e.user?.email || e.user?.phone) : (e.phone || e.email);
          doc.font('Helvetica').fontSize(8).text(String(name || '-').substring(0, 20), 45, y);
          doc.text(String(contact || '-').substring(0, 30), 135, y);
          doc.text(String(e.designation || '-').substring(0, 25), 290, y);
          doc.text(String(e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : '-'), 410, y);
          doc.text(String(e.monthlySalary || '-'), 485, y);
          y += 12;
        });
        break;
      }

      case 'salaries': {
        const sals = await SalaryPayment.find(Object.keys(createdAtRange).length ? { createdAt: createdAtRange } : {});
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Employee', 120, y); doc.text('Month', 250, y);
        doc.text('Total', 350, y); doc.text('Method', 450, y);
        y += 15;
        sals.forEach(s => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font('Helvetica').fontSize(8).text(new Date(s.createdAt).toISOString().split('T')[0], 50, y);
          doc.text(String(s.employeeName || '-'), 120, y);
          doc.text(String(s.month || '-'), 250, y);
          doc.text(String(s.amount || 0), 350, y);
          doc.text(String(s.paymentMethod || 'cash'), 450, y);
          y += 12;
        });
        break;
      }

      case 'expenses': {
        const exps = await Expense.find(Object.keys(dateQuery).length ? { date: dateQuery } : {});
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Title', 120, y); doc.text('Category', 280, y);
        doc.text('Amount', 380, y); doc.text('Method(s)', 460, y);
        y += 15;
        exps.forEach(e => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font('Helvetica').fontSize(8).text(String(e.date || '-'), 50, y);
          doc.text(String(e.title || '-').substring(0, 28), 120, y);
          doc.text(String(e.category || '-'), 280, y);
          doc.text(String(e.amount || 0), 380, y);
          doc.text(formatSplitsAsString(e).substring(0, 22), 460, y);
          y += 12;
        });
        break;
      }

      case 'income': {
        const incs = await ExtraIncome.find(Object.keys(dateQuery).length ? { date: dateQuery } : {});
        doc.fontSize(10).font('Helvetica-Bold').text('Date', 50, y);
        doc.text('Title', 120, y); doc.text('Source', 280, y);
        doc.text('Amount', 380, y); doc.text('Method(s)', 460, y);
        y += 15;
        incs.forEach(inc => {
          if (y > 750) { doc.addPage(); y = 50; }
          doc.font('Helvetica').fontSize(8).text(String(inc.date || '-'), 50, y);
          doc.text(String(inc.title || '-').substring(0, 28), 120, y);
          doc.text(String(inc.source || '-'), 280, y);
          doc.text(String(inc.amount || 0), 380, y);
          doc.text(formatSplitsAsString(inc).substring(0, 22), 460, y);
          y += 12;
        });
        break;
      }
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Service Detail Report
   For each service: total appointments, revenue, doctor fees, clinic profit
   ──────────────────────────────────────────────────────────────────────────── */
export const getServiceReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const apptFilter = { status: { $in: ['paid', 'completed'] } };
    if (Object.keys(dateFilter).length) apptFilter.appointmentDate = dateFilter;

    const appointments = await Appointment.find(apptFilter)
      .populate('service', 'name')
      .populate('doctor', 'name designation')
      .populate('extraCharges.service', 'name')
      .lean();

    // Group by service
    const serviceMap = {};

    const ensureService = (serviceId, serviceName) => {
      if (!serviceMap[serviceId]) {
        serviceMap[serviceId] = {
          serviceId,
          serviceName,
          totalAppointments: 0,
          totalRevenue: 0,
          totalDoctorFees: 0,
          totalProfit: 0,
          doctors: {},
        };
      }
      return serviceMap[serviceId];
    };

    const addToDoctor = (svcEntry, docId, docName, appts, revenue, doctorFees, profit) => {
      if (!svcEntry.doctors[docId]) {
        svcEntry.doctors[docId] = { doctorId: docId, doctorName: docName, appointments: 0, revenue: 0, doctorFees: 0, profit: 0 };
      }
      svcEntry.doctors[docId].appointments += appts;
      svcEntry.doctors[docId].revenue += revenue;
      svcEntry.doctors[docId].doctorFees += doctorFees;
      svcEntry.doctors[docId].profit += profit;
    };

    for (const appt of appointments) {
      // ── Main appointment service ────────────────────────────────────────
      const serviceId = appt.service?._id?.toString() || 'unknown';
      const serviceName = appt.service?.name || appt.serviceName || 'Unknown Service';
      const svc = ensureService(serviceId, serviceName);

      const price = Number(appt.price || 0);
      const doctorFee = Number(appt.doctorFee || 0);
      const profit = price - doctorFee;

      svc.totalAppointments += 1;
      svc.totalRevenue += price;
      svc.totalDoctorFees += doctorFee;
      svc.totalProfit += profit;

      const docId = appt.doctor?._id?.toString() || 'unknown';
      const docName = appt.doctor?.name || appt.doctorName || 'Unknown Doctor';
      addToDoctor(svc, docId, docName, 1, price, doctorFee, profit);

      // ── Extra charges — each maps to its own service row ───────────────
      for (const charge of (appt.extraCharges || [])) {
        if (!charge.isPaid) continue; // only count paid extra charges

        const ecServiceId = charge.service?._id?.toString() || `extra:${charge.serviceName}`;
        const ecServiceName = charge.service?.name || charge.serviceName || 'Extra Service';
        const ecSvc = ensureService(ecServiceId, ecServiceName);

        const ecPrice = Number(charge.price || 0);
        const ecDoctorFee = Number(charge.doctorFee || 0);
        const ecProfit = ecPrice - ecDoctorFee;

        ecSvc.totalAppointments += 1;
        ecSvc.totalRevenue += ecPrice;
        ecSvc.totalDoctorFees += ecDoctorFee;
        ecSvc.totalProfit += ecProfit;

        addToDoctor(ecSvc, docId, docName, 1, ecPrice, ecDoctorFee, ecProfit);
      }
    }

    const services = Object.values(serviceMap).map(s => ({
      ...s,
      doctors: Object.values(s.doctors),
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totals = services.reduce((acc, s) => ({
      totalAppointments: acc.totalAppointments + s.totalAppointments,
      totalRevenue: acc.totalRevenue + s.totalRevenue,
      totalDoctorFees: acc.totalDoctorFees + s.totalDoctorFees,
      totalProfit: acc.totalProfit + s.totalProfit,
    }), { totalAppointments: 0, totalRevenue: 0, totalDoctorFees: 0, totalProfit: 0 });

    res.json({ services, totals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
