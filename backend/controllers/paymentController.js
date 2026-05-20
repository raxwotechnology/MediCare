import DoctorPayment from '../models/DoctorPayment.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Appointment from '../models/Appointment.js';
import mongoose from 'mongoose';

/* Doctor payouts may use any of these methods (incl. bank transfer / cheque). */
const ALLOWED_METHODS = ['cash', 'card', 'online', 'bank_transfer', 'cheque'];

/* ─────────────────────────────────────────────────────────────────────────────
   Build a clean payment payload for doctor payouts.
   - Accepts either:
       { paymentSplits: [{method, amount}, ...] }   (preferred)
       { paymentMethod: 'cash' }                    (legacy single-method)
   - Optional `cashTendered` for cash-with-change scenarios.
   - Throws on invalid method or splits-mismatch.
   ──────────────────────────────────────────────────────────────────────────── */
const buildPayment = (body, expectedTotal) => {
  let splits = Array.isArray(body.paymentSplits) ? body.paymentSplits : null;

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

  // Legacy cashTendered support — fold any extra cash into the cash split
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

export const createDoctorPayment = async (req, res) => {
  try {
    const { doctorId, appointmentIds, amount, periodStart, periodEnd, notes } = req.body;
    const doc = await DoctorProfile.findById(doctorId);
    const payment = await DoctorPayment.create({
      doctor: doctorId,
      doctorName: doc?.name || 'Unknown',
      appointments: appointmentIds,
      amount,
      periodStart,
      periodEnd,
      notes,
      status: 'pending',
    });
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const markDoctorPaymentPaid = async (req, res) => {
  try {
    const payment = await DoctorPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'paid') return res.status(400).json({ message: 'Payment is already marked as paid' });

    let p;
    try {
      p = buildPayment(req.body, payment.amount);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    payment.status = 'paid';
    payment.paymentSplits = p.splits;
    payment.paymentMethod = p.dominantMethod;
    payment.cashTendered  = p.cashTendered;
    payment.totalTendered = p.totalTendered;
    payment.changeGiven   = p.changeGiven;
    payment.paidAt = new Date();
    payment.paidBy = req.user._id;
    await payment.save();
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteDoctorPayment = async (req, res) => {
  try {
    const payment = await DoctorPayment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    if (payment.status === 'paid') {
      return res.status(400).json({ message: 'Cannot delete a completed payment record' });
    }

    await DoctorPayment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Payment record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorPayments = async (req, res) => {
  try {
    const { doctorId, status } = req.query;
    const filter = {};
    if (doctorId) filter.doctor = doctorId;
    if (status) filter.status = status;

    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ user: req.user._id });
      if (!profile) return res.status(404).json({ message: 'Profile not found' });
      filter.doctor = profile._id;
    }

    const payments = await DoctorPayment.find(filter)
      .populate('doctor', 'name designation')
      .populate('paidBy', 'name')
      .sort('-createdAt');
    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorEarningsSummary = async (req, res) => {
  try {
    // FIX 1: Collect unique doctor IDs from both appointments and payment records
    const [apptDocs, payDocs] = await Promise.all([
      Appointment.distinct('doctor'),
      DoctorPayment.distinct('doctor')
    ]);
    const allDocIds = [...new Set([...apptDocs, ...payDocs].map(id => id.toString()))];

    const summary = await Promise.all(allDocIds.map(async (docIdStr) => {
      const docIdObj = new mongoose.Types.ObjectId(docIdStr);
      const docProfile = await DoctorProfile.findById(docIdStr).select('name');

      // Total paid out to this doctor via DoctorPayment records
      const paid = await DoctorPayment.aggregate([
        { $match: { doctor: docIdObj, status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      const pending = await DoctorPayment.aggregate([
        { $match: { doctor: docIdObj, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);

      // FIX 2: Appointment status flow is: pending → paid → with_doctor → completed
      // The old code only matched ['paid', 'completed'] — this MISSES 'with_doctor'
      // appointments that are currently being seen by the doctor.
      // Correct statuses where doctor has earned: 'paid', 'with_doctor', 'completed'
      const EARNED_STATUSES = ['paid', 'with_doctor', 'completed'];

      // Base consultation doctor fees
      const apptEarningsBase = await Appointment.aggregate([
        { $match: { doctor: docIdObj, status: { $in: EARNED_STATUSES } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$doctorFee', 0] } } } }
      ]);

      // FIX 3: Extra charges — the old code only counted extra charges on
      // appointments with status 'paid' or 'completed', missing 'with_doctor'.
      // Also: extra charges can exist on any non-pending appointment regardless
      // of the appointment's own status — what matters is extraCharges.isPaid.
      // We match all non-cancelled appointments and count only isPaid=true charges.
      const extraEarnings = await Appointment.aggregate([
        { $match: { doctor: docIdObj, status: { $in: EARNED_STATUSES } } },
        { $unwind: '$extraCharges' },
        { $match: { 'extraCharges.isPaid': true } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$extraCharges.doctorFee', 0] } } } }
      ]);

      const totalEarned = (apptEarningsBase[0]?.total || 0) + (extraEarnings[0]?.total || 0);

      // Fallback name snapshot for deleted doctors
      let name = docProfile?.name;
      if (!name) {
        const lastPay = await DoctorPayment.findOne({ doctor: docIdStr }).sort('-createdAt');
        name = lastPay?.doctorName;
      }
      if (!name) {
        const lastAppt = await Appointment.findOne({ doctor: docIdStr }).sort('-createdAt');
        name = lastAppt?.doctorName;
      }

      const paidAmount = paid[0]?.total || 0;

      return {
        doctor: { _id: docIdStr, name: name || 'Unknown Doctor', designation: docProfile?.designation || 'Dr.' },
        totalEarned,
        paidAmount,
        pendingAmount: totalEarned - paidAmount,
        paymentRecordsPending: pending[0]?.total || 0,
      };
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
