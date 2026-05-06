import mongoose from 'mongoose';

const paymentSplitSchema = new mongoose.Schema({
  method: { type: String, enum: ['cash', 'card', 'online'], required: true },
  amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const walkInBillSchema = new mongoose.Schema({
  billNumber: { type: Number },

  // Customer info (walk-in, no appointment needed)
  customerName:  { type: String, required: true },
  customerPhone: { type: String, default: '' },

  // Items sold
  medicines: [{
    name:     { type: String, required: true },
    price:    { type: Number, required: true },
    quantity: { type: Number, default: 1 },
  }],

  totalAmount: { type: Number, default: 0 },

  // Payment ── now supports multi-method splits
  isPaid:        { type: Boolean, default: false },
  paymentSplits: { type: [paymentSplitSchema], default: [] },
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', ''], default: '' }, // legacy / dominant
  paidAt:        { type: Date },
  // Cash overpayment tracking
  cashTendered:  { type: Number, default: 0 },
  totalTendered: { type: Number, default: 0 },
  changeGiven:   { type: Number, default: 0 },

  // Notes
  notes: { type: String, default: '' },

  // Issued by (pharmacist or admin)
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

// Auto-increment bill number + recalc total
walkInBillSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await this.constructor.findOne({}, {}, { sort: { billNumber: -1 } });
    this.billNumber = (last?.billNumber || 0) + 1;
  }
  this.totalAmount = this.medicines.reduce(
    (sum, m) => sum + (m.price * m.quantity), 0
  );
  next();
});

export default mongoose.model('WalkInBill', walkInBillSchema);
