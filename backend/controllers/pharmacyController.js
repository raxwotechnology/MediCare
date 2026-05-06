import Appointment from '../models/Appointment.js';

const ALLOWED_METHODS = ['cash', 'card', 'online'];

/**
 * Validate & normalise split-payment payloads.  See appointmentController.js
 * for the canonical version — duplicated here to avoid cross-controller
 * coupling.  Splits[].amount represents the TENDERED amount; any excess
 * over the bill total is returned to the customer as cash.
 */
const buildPayment = (body, expectedTotal) => {
  let splits = Array.isArray(body.splits) ? body.splits : null;

  // Legacy single-method shortcut
  if (!splits && body.paymentMethod) {
    splits = [{ method: body.paymentMethod, amount: expectedTotal }];
  }

  if (!splits || splits.length === 0) {
    throw new Error('At least one payment method is required');
  }

  splits = splits
    .map(s => ({ method: String(s.method || '').toLowerCase(), amount: Number(s.amount) }))
    .filter(s => s.amount > 0);

  if (splits.length === 0) throw new Error('Payment amount must be greater than zero');

  for (const s of splits) {
    if (!ALLOWED_METHODS.includes(s.method)) {
      throw new Error(`Invalid payment method: ${s.method}`);
    }
  }

  // Legacy cashTendered support
  const cashTenderedLegacy = Number(body.cashTendered);
  if (Number.isFinite(cashTenderedLegacy) && cashTenderedLegacy > 0) {
    const cashIdx = splits.findIndex(s => s.method === 'cash');
    if (cashIdx >= 0 && cashTenderedLegacy > splits[cashIdx].amount) {
      splits[cashIdx] = { ...splits[cashIdx], amount: cashTenderedLegacy };
    }
  }

  const totalTendered = splits.reduce((sum, s) => sum + s.amount, 0);

  if (totalTendered < expectedTotal - 0.01) {
    throw new Error(`Payment total (LKR ${totalTendered.toFixed(2)}) is less than amount due (LKR ${expectedTotal.toFixed(2)})`);
  }

  const changeGiven = Math.max(0, Number((totalTendered - expectedTotal).toFixed(2)));
  const total = expectedTotal;

  const dominantMethod = [...splits].sort((a, b) => b.amount - a.amount)[0].method;

  const cashSplit = splits.find(s => s.method === 'cash');
  const cashTendered = cashSplit ? cashSplit.amount : 0;

  return { splits, dominantMethod, total, totalTendered, changeGiven, cashTendered };
};

export const getPaidAppointments = async (req, res) => {
  try {
    const { date } = req.query;
    const filter = { status: { $in: ['paid', 'with_doctor', 'completed'] } };
    if (date) filter.appointmentDate = date;

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name')
      .populate('service', 'name')
      .sort('queueNumber');
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addPharmacyBill = async (req, res) => {
  try {
    const { medicines } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status === 'pending') return res.status(400).json({ message: 'Appointment not yet paid at reception' });

    const totalAmount = medicines.reduce((sum, m) => sum + (m.price * m.quantity), 0);
    const billNumber = (appt.pharmacyBills?.length || 0) + 1;

    appt.pharmacyBills.push({
      billNumber,
      medicines,
      totalAmount,
      billedAt: new Date(),
      billedBy: req.user._id,
      isPaid: false,
    });

    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Pay a pharmacy bill — split-payment + cash-overpayment aware.
 * Body: { billId, splits: [{ method, amount }, ...] }
 *    or { billId, paymentMethod: 'cash'|'card'|'online' }   (legacy)
 */
export const payPharmacyBill = async (req, res) => {
  try {
    const { billId } = req.body;

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const bill = appt.pharmacyBills.id(billId);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.isPaid) return res.status(400).json({ message: 'Bill already paid' });

    let payment;
    try {
      payment = buildPayment(req.body, bill.totalAmount);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    bill.isPaid = true;
    bill.paymentSplits = payment.splits;
    bill.paymentMethod = payment.dominantMethod; // legacy / dominant
    bill.paidAt = new Date();
    bill.cashTendered  = payment.cashTendered;
    bill.totalTendered = payment.totalTendered;
    bill.changeGiven   = payment.changeGiven;

    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
