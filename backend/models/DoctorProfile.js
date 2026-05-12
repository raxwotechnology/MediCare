import mongoose from 'mongoose';

const timeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  startTime: { type: String, required: true }, // e.g. "09:00"
  endTime:   { type: String, required: true }, // e.g. "17:00"
}, { _id: false });

const doctorProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null until doctor registers
  phone: { type: String, required: false, sparse: true },
  designation: {
    type: String,
    enum: ['Dr.', 'Mr.', 'Ms.', 'Mrs.', 'Prof.', 'Rev.'],
    default: 'Dr.'
  },
  name: { type: String, required: true },
  specialization: { type: String },
  slmcNumber: { type: String },
  services: [{
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    price: { type: Number, required: true },
    doctorFee: { type: Number, default: 0 }
  }],
  // Weekly availability schedule
  availability: { type: [timeSlotSchema], default: [] },
  isRegistered: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('DoctorProfile', doctorProfileSchema);
