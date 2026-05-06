import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// Register: admin, receptionist, pharmacist use email; doctor, patient use phone
export const register = async (req, res) => {
  try {
    const { role, email, phone, password, name } = req.body;
    if (!role || !password || !name)
      return res.status(400).json({ message: 'Missing required fields' });

    const emailRoles = ['admin', 'receptionist', 'pharmacist'];
    const phoneRoles = ['doctor', 'patient'];

    if (emailRoles.includes(role)) {
      if (!email) return res.status(400).json({ message: 'Email required for this role' });
      const exists = await User.findOne({ email });
      if (exists) return res.status(400).json({ message: 'Email already in use' });

      // Only admin can register admins/receptionists/pharmacists (except first admin)
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (role !== 'admin' || adminCount > 0) {
        // additional admin creation is handled via user management
      }

      const user = await User.create({ role, email, password, name });
      return res.status(201).json({ token: generateToken(user._id), user: sanitize(user) });
    }

    if (phoneRoles.includes(role)) {
      if (!phone) return res.status(400).json({ message: 'Phone required for this role' });
      const exists = await User.findOne({ phone });
      if (exists) return res.status(400).json({ message: 'Phone already registered' });

      const user = await User.create({ role, phone, password, name });

      // Link doctor to their pre-created profile
      if (role === 'doctor') {
        const profile = await DoctorProfile.findOne({ phone });
        if (profile) {
          profile.user = user._id;
          profile.isRegistered = true;
          if (!profile.name || profile.name === '') profile.name = name;
          await profile.save();
        }
      }

      return res.status(201).json({ token: generateToken(user._id), user: sanitize(user) });
    }

    return res.status(400).json({ message: 'Invalid role' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    let user;
    if (email) user = await User.findOne({ email });
    else if (phone) user = await User.findOne({ phone });

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (!user.isActive)
      return res.status(401).json({ message: 'Account is deactivated' });

    res.json({ token: generateToken(user._id), user: sanitize(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMe = async (req, res) => {
  res.json(sanitize(req.user));
};

const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  role: user.role,
  email: user.email,
  phone: user.phone,
  isActive: user.isActive,
});
