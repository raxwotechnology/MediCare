import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['admin', 'doctor', 'receptionist', 'pharmacist', 'patient'],
    required: true
  },
  // Email-based roles: admin, receptionist, pharmacist
  email: { type: String, sparse: true, lowercase: true, trim: true },
  // Phone-based roles: doctor, patient
  phone: { type: String, sparse: true, trim: true },

  password: { type: String, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

export default mongoose.model('User', userSchema);
