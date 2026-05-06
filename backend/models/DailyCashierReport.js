import mongoose from 'mongoose';

const dailyCashierReportSchema = new mongoose.Schema({
  date: {
    type: String, // String format YYYY-MM-DD
    required: true
  },
  department: {
    type: String,
    enum: ['pharmacy', 'reception'],
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paymentBreakdown: {
    cash: { type: Number, default: 0 },
    card: { type: Number, default: 0 },
    online: { type: Number, default: 0 }
  },
  denominations: {
    notes5000: { type: Number, default: 0 },
    notes1000: { type: Number, default: 0 },
    notes500: { type: Number, default: 0 },
    notes100: { type: Number, default: 0 },
    notes50: { type: Number, default: 0 },
    notes20: { type: Number, default: 0 },
    notes10: { type: Number, default: 0 } // adding 10 just in case
  },
  totalAmount: {
    type: Number,
    required: true
  },
  notes: {
    type: String
  },
  isFinalized: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Ensure one report per department per date
dailyCashierReportSchema.index({ date: 1, department: 1 }, { unique: true });

export default mongoose.model('DailyCashierReport', dailyCashierReportSchema);
