import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema({
  month: { type: String }, // e.g. "2024-06"
  amount: { type: Number },
  paidAt: { type: Date },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paymentMethod: { type: String, enum: ['cash', 'bank_transfer', 'cheque'], default: 'cash' },
});

const employeeSchema = new mongoose.Schema({
  // user is optional — janitors etc. don't need a system account
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // These fields are used when there is no user account
  name: { type: String }, // required if no user
  phone: { type: String },
  email: { type: String },
  designation: { type: String },
  monthlySalary: { type: Number, required: true },
  salaryPayments: [salaryPaymentSchema],
  isActive: { type: Boolean, default: true },
  hasAccount: { type: Boolean, default: true }, // false = no login account
}, { timestamps: true });

export default mongoose.model('Employee', employeeSchema);
