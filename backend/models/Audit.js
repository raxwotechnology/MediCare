import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String },
  role: { type: String },
  action: { type: String, required: true },
  entity: { type: String }, // e.g. 'Appointment', 'User'
  entityId: { type: String },
  details: { type: Object },
  ip: { type: String },
}, { timestamps: true });

export default mongoose.model('Audit', auditSchema);
