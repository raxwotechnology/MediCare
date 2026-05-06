import mongoose from 'mongoose';

const paymentSplitSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const doctorPaymentSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true },
  doctorName: { type: String }, // Snapshot of name in case doctor is deleted
  appointments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' }],
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },

  // Legacy single-method (still kept so old reports work).  Holds the
  // dominant (largest) split when paid.
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    default: 'cash'
  },
  paymentSplits: { type: [paymentSplitSchema], default: [] },
  // Cash overpayment tracking — useful when paying a doctor in cash and
  // change is returned (rare for salary payouts but supported for parity).
  cashTendered: { type: Number, default: 0 },
  totalTendered: { type: Number, default: 0 },
  changeGiven:  { type: Number, default: 0 },

  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  periodStart: { type: Date },
  periodEnd: { type: Date },
  notes: { type: String },
}, { timestamps: true });

export default mongoose.model('DoctorPayment', doctorPaymentSchema);
