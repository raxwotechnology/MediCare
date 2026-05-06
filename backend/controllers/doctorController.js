import DoctorProfile from '../models/DoctorProfile.js';
import Appointment from '../models/Appointment.js';
import DoctorPayment from '../models/DoctorPayment.js';

export const createDoctor = async (req, res) => {
  try {
    const { phone, name, specialization, slmcNumber } = req.body;
    const exists = await DoctorProfile.findOne({ phone });
    if (exists) return res.status(400).json({ message: 'Doctor with this phone already exists' });
    const doctor = await DoctorProfile.create({ phone, name, specialization, slmcNumber });
    res.status(201).json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctors = async (req, res) => {
  try {
    const doctors = await DoctorProfile.find().populate('services.service');
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorById = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id).populate('services.service');
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyDoctorProfile = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findOne({ user: req.user._id }).populate('services.service');
    if (!doctor) return res.status(404).json({ message: 'Profile not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateDoctor = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const addServiceToDoctor = async (req, res) => {
  try {
    const { serviceId, price, doctorFee } = req.body;
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const already = doctor.services.find(s => s.service.toString() === serviceId);
    if (already) return res.status(400).json({ message: 'Service already added' });

    doctor.services.push({ service: serviceId, price, doctorFee: doctorFee || 0 });
    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeServiceFromDoctor = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findById(req.params.id);
    doctor.services = doctor.services.filter(s => s.service.toString() !== req.params.serviceId);
    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateServiceInDoctor = async (req, res) => {
  try {
    const { price, doctorFee } = req.body;
    const doctor = await DoctorProfile.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const serviceIndex = doctor.services.findIndex(s => s.service.toString() === req.params.serviceId);
    if (serviceIndex === -1) return res.status(404).json({ message: 'Service not found in doctor profile' });

    doctor.services[serviceIndex].price = price !== undefined ? price : doctor.services[serviceIndex].price;
    doctor.services[serviceIndex].doctorFee = doctorFee !== undefined ? doctorFee : doctor.services[serviceIndex].doctorFee;

    await doctor.save();
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateAvailability = async (req, res) => {
  try {
    const { availability } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ message: 'availability must be an array' });
    }
    const doctor = await DoctorProfile.findByIdAndUpdate(
      req.params.id,
      { availability },
      { new: true }
    ).populate('services.service');
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getDoctorStats = async (req, res) => {
  try {
    const doctor = await DoctorProfile.findOne({ user: req.user._id });
    if (!doctor) return res.status(404).json({ message: 'Profile not found' });

    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter.appointmentDate = { $gte: startDate };
    if (endDate) dateFilter.appointmentDate = { ...dateFilter.appointmentDate, $lte: endDate };

    const appointments = await Appointment.find({
      doctor: doctor._id,
      status: { $in: ['paid', 'completed'] },
      ...dateFilter
    }).populate('service');

    const totalServices = appointments.length;
    const totalAmount = appointments.reduce((sum, a) => sum + (a.doctorFee !== undefined ? a.doctorFee : a.price), 0);

    const payments = await DoctorPayment.find({ doctor: doctor._id });
    const paidAmount = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
    const pendingAmount = payments.filter(p => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

    res.json({ totalServices, totalAmount, paidAmount, pendingAmount, appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
