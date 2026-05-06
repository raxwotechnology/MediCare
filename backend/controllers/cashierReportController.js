import DailyCashierReport from '../models/DailyCashierReport.js';
import Appointment from '../models/Appointment.js';
import Expense from '../models/Expense.js';
import ExtraIncome from '../models/ExtraIncome.js';
import WalkInBill from '../models/WalkInBill.js';

/**
 * Reduce a payment block (which may have split methods) into a per-method
 * { cash, card, online } map.  Falls back to the legacy `paymentMethod`
 * field for older records that pre-date split payments.
 *
 * IMPORTANT: split amounts now represent what was TENDERED — they may sum
 * to MORE than the bill, with the excess returned to the customer as cash.
 * To report NET income per method, we subtract `changeGiven` from the cash
 * bucket (since change is always returned in cash).
 */
const splitToBuckets = (payment) => {
  const out = { cash: 0, card: 0, online: 0 };
  if (!payment) return out;

  if (Array.isArray(payment.paymentSplits) && payment.paymentSplits.length > 0) {
    for (const s of payment.paymentSplits) {
      if (out[s.method] !== undefined) out[s.method] += Number(s.amount || 0);
    }
  } else if (Array.isArray(payment.splits) && payment.splits.length > 0) {
    // Reception payment uses the same shape but the array lives on `splits`
    for (const s of payment.splits) {
      if (out[s.method] !== undefined) out[s.method] += Number(s.amount || 0);
    }
  } else {
    // Legacy single-method record
    const method = payment.paymentMethod;
    const amt    = Number(payment.amount || payment.totalAmount || payment.totalPaid || 0);
    if (method && out[method] !== undefined && amt > 0) {
      out[method] += amt;
    }
  }

  // Subtract change returned to the customer (always given in cash).
  const change = Number(payment.changeGiven || 0);
  if (change > 0) {
    out.cash = Math.max(0, out.cash - change);
  }
  return out;
};

const addBuckets = (a, b) => ({
  cash:   (a.cash   || 0) + (b.cash   || 0),
  card:   (a.card   || 0) + (b.card   || 0),
  online: (a.online || 0) + (b.online || 0),
});

// ── Submit Report ───────────────────────────────────────────────────────────
export const submitReport = async (req, res) => {
  try {
    const { date, department, paymentBreakdown, denominations, notes } = req.body;

    const totalAmount = (paymentBreakdown.cash || 0) + (paymentBreakdown.card || 0) + (paymentBreakdown.online || 0);

    const report = await DailyCashierReport.findOneAndUpdate(
      { date, department },
      {
        submittedBy: req.user._id,
        paymentBreakdown,
        denominations,
        totalAmount,
        notes,
        isFinalized: true
      },
      { upsert: true, new: true }
    );

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Error submitting report' });
  }
};

// ── Get Reports (List) ──────────────────────────────────────────────────────
export const getReports = async (req, res) => {
  try {
    const { fromDate, toDate, department } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = fromDate;
      if (toDate) filter.date.$lte = toDate;
    }

    const reports = await DailyCashierReport.find(filter)
      .populate('submittedBy', 'name')
      .sort('-date');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get Daily Summary (Admin) ───────────────────────────────────────────────
export const getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    // 1. Submitted cashier reports
    const cashierReports = await DailyCashierReport.find({ date }).populate('submittedBy', 'name');

    // 2. Expenses & extra income for the date
    const expenses      = await Expense.find({ date: { $gte: date, $lte: date } });
    const extraIncomes  = await ExtraIncome.find({ date: { $gte: date, $lte: date } });

    // 3. System-calculated income (audit check)
    const appts = await Appointment.find({ appointmentDate: date });

    // Reception payment
    let apptIncome = { cash: 0, card: 0, online: 0 };
    for (const a of appts) {
      if (a.receptionPayment && a.receptionPayment.totalPaid) {
        apptIncome = addBuckets(apptIncome, splitToBuckets(a.receptionPayment));
      }
    }

    // Pharmacy bills + extra charges
    let pharmacyIncome = { cash: 0, card: 0, online: 0 };
    for (const a of appts) {
      for (const b of a.pharmacyBills || []) {
        if (b.isPaid) pharmacyIncome = addBuckets(pharmacyIncome, splitToBuckets(b));
      }
      // Extra charges roll up under reception, since the receptionist takes them
      for (const c of a.extraCharges || []) {
        if (c.isPaid) apptIncome = addBuckets(apptIncome, splitToBuckets(c));
      }
    }

    // Walk-in pharmacy bills (NB: original code filtered by `date` but
    // WalkInBill stores `createdAt`, not a `date` field — fix that here.)
    const start = new Date(date + 'T00:00:00.000Z');
    const end   = new Date(date + 'T23:59:59.999Z');
    const walkins = await WalkInBill.find({
      isDeleted: false,
      createdAt: { $gte: start, $lte: end },
    });
    for (const w of walkins) {
      if (w.isPaid) pharmacyIncome = addBuckets(pharmacyIncome, splitToBuckets(w));
    }

    res.json({
      date,
      cashierReports,
      expenses,
      extraIncomes,
      systemCalculated: {
        reception: apptIncome,
        pharmacy:  pharmacyIncome,
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
