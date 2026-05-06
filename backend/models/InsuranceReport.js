import mongoose from 'mongoose';

const insuranceReportSchema = new mongoose.Schema({
  reportNumber: { type: Number },

  // Patient info
  patientName: { type: String, required: true },
  nic: { type: String, required: true },
  contactPhone: { type: String },
  contactEmail: { type: String },

  // Insurance info
  insuranceCompany: { type: String, required: true },
  policyNumber: { type: String, required: true },

  // Hospital / Medical details
  hospitalName: { type: String, required: true },
  admissionDate: { type: Date, required: true },
  dischargeDate: { type: Date },
  diagnosis: { type: String, required: true },
  treatmentDetails: { type: String },
  doctorName: { type: String },
  slmcNumber: { type: String },
  doctorNotes: { type: String },

  // Cost breakdown
  consultationFee: { type: Number, default: 0 },
  labTestCharges: { type: Number, default: 0 },
  medicineCost: { type: Number, default: 0 },
  roomCharges: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },

  // Attached document references (names/labels only — no file upload in this system)
  attachedDocuments: [{ label: String, note: String }],

  // Claim status
  claimStatus: {
    type: String,
    enum: ['pending', 'submitted', 'approved', 'rejected'],
    default: 'pending',
  },

  // Issued by
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

// Auto-increment report number
insuranceReportSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await this.constructor.findOne({}, {}, { sort: { reportNumber: -1 } });
    this.reportNumber = (last?.reportNumber || 0) + 1;
  }
  next();
});

// Virtual: total claim amount
insuranceReportSchema.virtual('totalAmount').get(function () {
  return (this.consultationFee || 0) + (this.labTestCharges || 0) +
    (this.medicineCost || 0) + (this.roomCharges || 0) + (this.otherCharges || 0);
});

insuranceReportSchema.set('toJSON', { virtuals: true });

export default mongoose.model('InsuranceReport', insuranceReportSchema);
