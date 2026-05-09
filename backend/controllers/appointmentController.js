import Appointment from '../models/Appointment.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Service from '../models/Service.js';
import User from '../models/User.js';

/* ─────────────────────────────────────────────────────────────────────────────
   Split-payment helpers.
   ──────────────────────────────────────────────────────────────────────────── */
const ALLOWED_METHODS = ['cash', 'card', 'online'];

/**
 * Validate & normalise a list of payment splits against an expected total.
 * Accepts either:
 *   • a `splits` array  →  [{ method, amount }, ...]   (preferred)
 *   • a legacy `paymentMethod` string (single-method full payment)
 *
 * Each split's `amount` is what the customer actually TENDERED via that
 * method.  The total tendered must be at least the bill — overpayment is
 * allowed and is returned as `changeGiven` so the cashier can give it back.
 *
 * `cashTendered` is also accepted as a backwards-compatible alias for
 * "extra cash on top of the cash split".  When supplied it is folded into
 * the cash row's amount so the result is consistent.
 *
 * Returns { splits, dominantMethod, total, totalTendered, changeGiven,
 *           cashTendered } or throws.
 */
const buildPayment = (body, expectedTotal) => {
  let splits = Array.isArray(body.splits) ? body.splits : null;

  // Legacy single-method shortcut — treat as one split for the full amount
  if (!splits && body.paymentMethod) {
    splits = [{ method: body.paymentMethod, amount: expectedTotal }];
  }

  if (!splits || splits.length === 0) {
    throw new Error('At least one payment method is required');
  }

  // Sanitise + validate every entry
  splits = splits
    .map(s => ({ method: String(s.method || '').toLowerCase(), amount: Number(s.amount) }))
    .filter(s => s.amount > 0);

  if (splits.length === 0) throw new Error('Payment amount must be greater than zero');

  for (const s of splits) {
    if (!ALLOWED_METHODS.includes(s.method)) {
      throw new Error(`Invalid payment method: ${s.method}`);
    }
  }

  // Legacy cashTendered support — if a separate cashTendered value was
  // supplied that exceeds the cash split, fold the excess into the cash row
  // so that splits[].amount always represents the true tendered value.
  const cashTenderedLegacy = Number(body.cashTendered);
  if (Number.isFinite(cashTenderedLegacy) && cashTenderedLegacy > 0) {
    const cashIdx = splits.findIndex(s => s.method === 'cash');
    if (cashIdx >= 0 && cashTenderedLegacy > splits[cashIdx].amount) {
      splits[cashIdx] = { ...splits[cashIdx], amount: cashTenderedLegacy };
    }
  }

  const totalTendered = splits.reduce((sum, s) => sum + s.amount, 0);

  // Tendered must cover the bill (over is fine, under is not)
  if (totalTendered < expectedTotal - 0.01) {
    throw new Error(`Payment total (LKR ${totalTendered.toFixed(2)}) is less than amount due (LKR ${expectedTotal.toFixed(2)})`);
  }

  const changeGiven = Math.max(0, Number((totalTendered - expectedTotal).toFixed(2)));

  // For storage parity with the legacy schema we still emit a `total` that
  // matches the bill (the consumer side reads totalPaid = bill amount).
  const total = expectedTotal;

  // Dominant method = the split with the largest amount.  Used for legacy
  // single-method reporting fields.
  const dominantMethod = [...splits].sort((a, b) => b.amount - a.amount)[0].method;

  // Cash tendered = whatever ended up in the cash row (0 if no cash split)
  const cashSplit = splits.find(s => s.method === 'cash');
  const cashTendered = cashSplit ? cashSplit.amount : 0;

  return { splits, dominantMethod, total, totalTendered, changeGiven, cashTendered };
};

/* ─────────────────────────────────────────────────────────────────────────────
   CRUD
   ──────────────────────────────────────────────────────────────────────────── */
export const createAppointment = async (req, res) => {
  try {
    const { patientName, patientPhone, doctorId, serviceId, appointmentDate } = req.body;

    const doctor = await DoctorProfile.findById(doctorId).populate('services.service');
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const svc = doctor.services.find(s => s.service?._id.toString() === serviceId);
    if (!svc) return res.status(404).json({ message: 'Service not available for this doctor' });

    const todayCount = await Appointment.countDocuments({ doctor: doctorId, appointmentDate });
    const patientUser = await User.findOne({ phone: patientPhone, role: 'patient' });

    const appointment = await Appointment.create({
      patientName,
      patientPhone,
      patientUser: patientUser?._id || null,
      doctor: doctorId,
      doctorName: doctor.name,
      service: serviceId,
      serviceName: svc.service?.name || 'Medical Service',
      price: svc.price,
      doctorFee: svc.doctorFee || 0,
      appointmentDate,
      queueNumber: todayCount + 1,
    });

    res.status(201).json(appointment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getQueueNumber = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const count = await Appointment.countDocuments({ doctor: doctorId, appointmentDate: date });
    const currentAppointment = await Appointment.findOne({ doctor: doctorId, appointmentDate: date, status: 'with_doctor' });

    res.json({
       nextQueue: count + 1,
       currentQueue: currentAppointment ? currentAppointment.queueNumber : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const lookupPatient = async (req, res) => {
  try {
    const { phone } = req.query;
    const patient = await User.findOne({ phone, role: 'patient' }).select('name phone');
    if (!patient) {
      const lastAppt = await Appointment.findOne({ patientPhone: phone }).sort('-createdAt');
      if (lastAppt) return res.json({ name: lastAppt.patientName, phone });
      return res.json(null);
    }
    res.json({ name: patient.name, phone: patient.phone });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status === 'completed') return res.status(400).json({ message: 'Cannot cancel a completed appointment' });
    appt.status = 'cancelled';
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAppointments = async (req, res) => {
  try {
    const { date, status, doctorId } = req.query;
    const filter = {};
    if (date) filter.appointmentDate = date;
    if (status) filter.status = status;
    if (doctorId) filter.doctor = doctorId;

    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ user: req.user._id });
      if (!profile) return res.status(404).json({ message: 'Doctor profile not found' });
      filter.doctor = profile._id;
    }
    if (req.user.role === 'patient') {
      filter.$or = [
        { patientUser: req.user._id },
        { patientPhone: req.user.phone }
      ];
    }

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name specialization')
      .populate('service', 'name')
      .sort('queueNumber');

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id)
      .populate('doctor')
      .populate('service')
      .populate('extraCharges.service', 'name')
      .populate('extraCharges.addedBy', 'name')
      .populate('receptionPayment.paidBy', 'name');
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Receptionist marks appointment as paid — split-payment aware.
   Body: { splits: [{ method, amount }, ...] }   (preferred)
      or { paymentMethod: 'cash'|'card'|'online' }   (legacy single-method)
   ──────────────────────────────────────────────────────────────────────────── */
export const markAsPaid = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status !== 'pending') return res.status(400).json({ message: 'Appointment is not in pending state' });

    let payment;
    try {
      payment = buildPayment(req.body, appt.price);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    appt.status = 'paid';
    appt.receptionPayment = {
      splits:        payment.splits,
      totalPaid:     payment.total,
      amount:        payment.total,           // alias
      paymentMethod: payment.dominantMethod,  // legacy / dominant
      paidAt:        new Date(),
      paidBy:        req.user._id,
      cashTendered:  payment.cashTendered,
      totalTendered: payment.totalTendered,
      changeGiven:   payment.changeGiven,
    };
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Doctor accepts next patient
   ──────────────────────────────────────────────────────────────────────────── */
export const acceptPatient = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status !== 'paid') return res.status(400).json({ message: 'Patient has not paid yet' });

    const profile = await DoctorProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ message: 'Doctor profile not found' });

    const activePatient = await Appointment.findOne({
      doctor: profile._id,
      appointmentDate: appt.appointmentDate,
      status: 'with_doctor',
    });
    if (activePatient) return res.status(400).json({ message: `Already attending patient #${activePatient.queueNumber}. Complete them first.` });

    appt.status = 'with_doctor';
    appt.doctorQueue = {
      acceptedAt: new Date(),
      acceptedBy: req.user._id,
    };
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const completePatient = async (req, res) => {
  try {
    const { prescription, prescribedMedicines } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.status !== 'with_doctor') return res.status(400).json({ message: 'Patient is not currently with doctor' });

    appt.prescription = prescription || '';
    appt.prescribedMedicines = prescribedMedicines || [];
    appt.status = 'completed';
    appt.doctorQueue = {
      ...appt.doctorQueue,
      completedAt: new Date(),
    };
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addPrescription = async (req, res) => {
  try {
    const { prescription, prescribedMedicines } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    appt.prescription = prescription;
    appt.prescribedMedicines = prescribedMedicines;
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Pharmacy bills — split-payment aware.
   ──────────────────────────────────────────────────────────────────────────── */
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
    bill.paymentMethod = payment.dominantMethod;
    bill.paidAt = new Date();
    bill.cashTendered = payment.cashTendered;
    bill.totalTendered = payment.totalTendered;
    bill.changeGiven  = payment.changeGiven;

    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Extra charges — add additional services AFTER the original payment.
   These are completely independent line items with their own payment.
   ──────────────────────────────────────────────────────────────────────────── */
export const addExtraCharge = async (req, res) => {
  try {
    const { serviceId, serviceName, description, price, doctorFee } = req.body;

    if (!serviceName || price == null) {
      return res.status(400).json({ message: 'Service name and price are required' });
    }
    if (Number(price) < 0) {
      return res.status(400).json({ message: 'Price cannot be negative' });
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (['pending', 'cancelled'].includes(appt.status)) {
      return res.status(400).json({ message: 'Cannot add extra charges to an unpaid or cancelled appointment' });
    }

    // If a serviceId was provided, hydrate the snapshot from the Service doc
    let resolvedName = serviceName;
    let resolvedServiceId = null;
    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (svc) {
        resolvedServiceId = svc._id;
        resolvedName = svc.name || serviceName;
      }
    }

    appt.extraCharges.push({
      service:     resolvedServiceId,
      serviceName: resolvedName,
      description: description || '',
      price:       Number(price),
      doctorFee:   Number(doctorFee || 0),
      addedAt:     new Date(),
      addedBy:     req.user._id,
      isPaid:      false,
    });

    await appt.save();
    res.status(201).json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const payExtraCharge = async (req, res) => {
  try {
    const { chargeId } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const charge = appt.extraCharges.id(chargeId);
    if (!charge) return res.status(404).json({ message: 'Extra charge not found' });
    if (charge.isPaid) return res.status(400).json({ message: 'Extra charge already paid' });

    let payment;
    try {
      payment = buildPayment(req.body, charge.price);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    charge.isPaid = true;
    charge.paymentSplits = payment.splits;
    charge.paymentMethod = payment.dominantMethod;
    charge.paidAt = new Date();
    charge.paidBy = req.user._id;
    charge.cashTendered = payment.cashTendered;
    charge.totalTendered = payment.totalTendered;
    charge.changeGiven  = payment.changeGiven;

    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteExtraCharge = async (req, res) => {
  try {
    const { chargeId } = req.params;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });

    const charge = appt.extraCharges.id(chargeId);
    if (!charge) return res.status(404).json({ message: 'Extra charge not found' });
    if (charge.isPaid) {
      return res.status(400).json({ message: 'Cannot delete a paid extra charge' });
    }

    appt.extraCharges.pull({ _id: chargeId });
    await appt.save();
    res.json(appt);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* Bumps the printed-counter — used by the frontend after a successful print
   so admins can audit how many invoice copies were issued.  Optional. */
export const recordInvoicePrint = async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    appt.invoicePrintedCount = (appt.invoicePrintedCount || 0) + 1;
    await appt.save();
    res.json({ invoiceNumber: appt.invoiceNumber, invoicePrintedCount: appt.invoicePrintedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getActiveDates = async (req, res) => {
  try {
    const filter = {};
    // Doctors only see their own
    if (req.user.role === 'doctor') {
      const profile = await DoctorProfile.findOne({ user: req.user._id });
      if (profile) filter.doctor = profile._id;
    } else if (req.query.doctorId) {
      // Admins / receptionists can pass ?doctorId=... to filter
      filter.doctor = req.query.doctorId;
    }
    // Optional status filter, e.g. ?excludeCancelled=1
    if (req.query.excludeCancelled === '1') {
      filter.status = { $ne: 'cancelled' };
    }
    const dates = await Appointment.distinct('appointmentDate', filter);
    res.json(dates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Public endpoint — returns dates that already have appointments for a given
 * doctor, so the patient/receptionist booking calendar can highlight them.
 * Requires ?doctorId=... in the query.
 */
/**
 * Public endpoint — lets a patient look up their own appointment by
 * phone number + date + doctor.  Returns safe fields only (no payment
 * details) so no authentication is required.
 */
export const checkAppointment = async (req, res) => {
  try {
    const { phone, date, doctorId } = req.query;
    if (!phone || !date) {
      return res.status(400).json({ message: 'Phone number and date are required' });
    }

    const filter = { patientPhone: phone, appointmentDate: date };
    if (doctorId) filter.doctor = doctorId;

    const appointments = await Appointment.find(filter)
      .populate('doctor', 'name specialization availability')
      .populate('service', 'name')
      .select('patientName queueNumber appointmentDate status doctor doctorName service serviceName price')
      .sort('queueNumber');

    if (!appointments.length) {
      return res.status(404).json({ message: 'No appointment found for the provided details' });
    }

    res.json(appointments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getActiveDatesPublic = async (req, res) => {
  try {
    const { doctorId } = req.query;
    if (!doctorId) return res.status(400).json({ message: 'doctorId is required' });

    const dates = await Appointment.distinct('appointmentDate', {
      doctor: doctorId,
      status: { $ne: 'cancelled' },
    });
    res.json(dates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
