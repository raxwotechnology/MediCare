import mongoose from 'mongoose';

const paymentSplitSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    required: true
  },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  amount: { type: Number, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  category: { type: String }, // e.g. 'Utilities', 'Supplies', etc.

  // Legacy single-method field — kept for backwards compatibility & old reports.
  // It holds the *dominant* (largest) split method.
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'online', 'bank_transfer', 'cheque'],
    default: 'cash'
  },
  // New: itemised list of payments. May contain 1 or more rows.
  paymentSplits: { type: [paymentSplitSchema], default: [] },

  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Expense', expenseSchema);
