import mongoose from 'mongoose';

/* ─────────────────────────────────────────────────────────────────────────────
   Reusable payment sub-document.
   Supports split payments — a single bill may be paid using more than one
   method (e.g. LKR 500 cash + LKR 300 card).  The legacy `paymentMethod`
   string is kept for backward compatibility with old reports; new code
   should read from `splits`.
   In addition, `cashTendered` / `changeGiven` capture overpayment on cash
   so receipts can print "Cash Given / Change" lines.
   ──────────────────────────────────────────────────────────────────────────── */
const paymentSplitSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'online'], required: true },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  splits:        { type: [paymentSplitSchema], default: [] },
  totalPaid:     { type: Number, default: 0 },
  paidAt:        { type: Date },
  paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Legacy / convenience: dominant method (largest split). Kept so old
  // reports/cashier-summaries that still read `paymentMethod` keep working.
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', ''], default: '' },
  amount:        { type: Number },                // alias for totalPaid
  // Cash overpayment tracking
  cashTendered:  { type: Number, default: 0 },    // legacy: the cash split's tendered amount
  totalTendered: { type: Number, default: 0 },    // sum of all tendered amounts (≥ totalPaid)
  changeGiven:   { type: Number, default: 0 },    // total tendered − bill (returned as cash)
}, { _id: false });

/* ─────────────────────────────────────────────────────────────────────────────
   Pharmacy bill — payment block now supports splits.
   ──────────────────────────────────────────────────────────────────────────── */
const pharmacyBillSchema = new mongoose.Schema({
  billNumber:  { type: Number, default: 1 },
  medicines:   [{ name: String, price: Number, quantity: Number }],
  totalAmount: { type: Number, default: 0 },
  billedAt:    { type: Date, default: Date.now },
  billedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Payment for this individual bill
  isPaid:        { type: Boolean, default: false },
  paymentSplits: { type: [paymentSplitSchema], default: [] },
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', ''], default: '' }, // legacy
  paidAt:        { type: Date },
  cashTendered:  { type: Number, default: 0 },
  totalTendered: { type: Number, default: 0 },
  changeGiven:   { type: Number, default: 0 },
}, { _id: true });

/* ─────────────────────────────────────────────────────────────────────────────
   Extra charge — additional service added to an existing appointment
   (after the original consultation has already been paid for).
   ──────────────────────────────────────────────────────────────────────────── */
const extraChargeSchema = new mongoose.Schema({
  service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  serviceName: { type: String, required: true },
  description: { type: String, default: '' },
  price:       { type: Number, required: true, min: 0 },
  doctorFee:   { type: Number, default: 0 },

  addedAt: { type: Date, default: Date.now },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Payment block (split-aware)
  isPaid:        { type: Boolean, default: false },
  paymentSplits: { type: [paymentSplitSchema], default: [] },
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', ''], default: '' }, // legacy / dominant
  paidAt:        { type: Date },
  paidBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cashTendered:  { type: Number, default: 0 },
  totalTendered: { type: Number, default: 0 },
  changeGiven:   { type: Number, default: 0 },
}, { _id: true, timestamps: false });

const appointmentSchema = new mongoose.Schema({
  // Guest or registered patient
  patientName:  { type: String, required: true },
  patientPhone: { type: String, required: true },
  patientUser:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  doctor:            { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
  doctorName:        { type: String },
  doctorDesignation: { type: String },
  service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  serviceName: { type: String },
  price:       { type: Number, required: true },
  doctorFee:   { type: Number, default: 0 },

  queueNumber:     { type: Number },
  appointmentDate: { type: String, required: true }, // YYYY-MM-DD

  status: {
    type: String,
    // pending → paid → with_doctor → completed → cancelled
    enum: ['pending', 'paid', 'with_doctor', 'completed', 'cancelled'],
    default: 'pending'
  },

  // Doctor queue tracking
  doctorQueue: {
    acceptedAt:  Date,
    completedAt: Date,
    acceptedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // doctor user id
  },

  // Reception payment (split-aware).  We keep the same field name so any
  // place that already reads `receptionPayment.paymentMethod` keeps working.
  receptionPayment: {
    type: paymentSchema,
    default: () => ({}),
  },

  // Doctor's prescription
  prescription:         { type: String },
  prescribedMedicines:  [{ name: String, dosage: String, quantity: Number }],

  // Multiple pharmacy bills per appointment
  pharmacyBills: [pharmacyBillSchema],

  // Additional services added after the original payment
  extraCharges: [extraChargeSchema],

  // Invoice tracking — incremented every time the user prints/downloads
  // the consultation invoice.  Useful for audit but optional.
  invoiceNumber:       { type: String },
  invoicePrintedCount: { type: Number, default: 0 },

  notes: { type: String },
}, { timestamps: true });

/* Auto-assign a stable invoice number once we have an _id. */
appointmentSchema.pre('save', function (next) {
  if (!this.invoiceNumber && this._id) {
    // Take the last 6 chars of the ObjectId for a short, unique invoice ref.
    this.invoiceNumber = `INV-${this._id.toString().slice(-6).toUpperCase()}`;
  }
  next();
});

export default mongoose.model('Appointment', appointmentSchema);
