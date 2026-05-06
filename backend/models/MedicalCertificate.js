import mongoose from 'mongoose';

const medicalCertificateSchema = new mongoose.Schema({
  certificateNumber: { type: Number },

  // Patient info
  patientName: { type: String, required: true },
  nicOrStudentId: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },

  // Medical details
  examinationDate: { type: Date, required: true },
  diagnosis: { type: String, required: true },
  unfitFromDate: { type: Date, required: true },
  unfitToDate: { type: Date, required: true },
  remarks: { type: String, default: '' },

  // Doctor / issuer info
  doctorName: { type: String, required: true },
  slmcNumber: { type: String, required: true },
  hospitalName: { type: String, required: true },

  // Issued by (user)
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Soft delete
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
}, { timestamps: true });

// Auto-increment certificate number
medicalCertificateSchema.pre('save', async function (next) {
  if (this.isNew) {
    const last = await this.constructor.findOne({}, {}, { sort: { certificateNumber: -1 } });
    this.certificateNumber = (last?.certificateNumber || 0) + 1;
  }
  next();
});

export default mongoose.model('MedicalCertificate', medicalCertificateSchema);
