import mongoose from 'mongoose';

const paymentSplitSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const extraIncomeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  source: { type: String }, // e.g. 'Donation', 'Sponsorship', etc.

  // Legacy single-method field — kept for back-compat and existing reports.
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    default: 'cash'
  },
  paymentSplits: { type: [paymentSplitSchema], default: [] },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('ExtraIncome', extraIncomeSchema);
