import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // might be null if deleted
  employeeName: { type: String, required: true },
  employeeDesignation: { type: String },
  month: { type: String, required: true }, // YYYY-MM
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'card', 'bank_transfer', 'cheque', 'online'], default: 'cash' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('SalaryPayment', salaryPaymentSchema);
