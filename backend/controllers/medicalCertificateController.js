import MedicalCertificate from '../models/MedicalCertificate.js';

// ── Create ──────────────────────────────────────────────────────────────────
export const createCertificate = async (req, res) => {
  try {
    const {
      patientName, nicOrStudentId, age, gender,
      examinationDate, diagnosis, unfitFromDate, unfitToDate,
      doctorName, slmcNumber, hospitalName, remarks,
    } = req.body;

    // Validation: unfit dates must cover exam date
    const examD = new Date(examinationDate);
    const fromD = new Date(unfitFromDate);
    const toD   = new Date(unfitToDate);
    if (fromD > examD || toD < examD) {
      return res.status(400).json({ message: 'Unfit dates must cover the examination date.' });
    }
    if (fromD > toD) {
      return res.status(400).json({ message: '"Unfit From" must be before "Unfit To".' });
    }

    // Basic SLMC number format check: letters + digits (adjust regex to suit local rules)
    if (!/^[A-Za-z0-9/-]{3,20}$/.test(slmcNumber)) {
      return res.status(400).json({ message: 'Invalid SLMC registration number format.' });
    }

    const cert = await MedicalCertificate.create({
      patientName, nicOrStudentId, age, gender,
      examinationDate: examD, diagnosis, unfitFromDate: fromD, unfitToDate: toD,
      doctorName, slmcNumber, hospitalName, remarks,
      issuedBy: req.user._id,
    });
    res.status(201).json(cert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get All (with filters) ───────────────────────────────────────────────────
export const getCertificates = async (req, res) => {
  try {
    const { search, doctorName, fromDate, toDate } = req.query;
    const filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { nicOrStudentId: { $regex: search, $options: 'i' } },
      ];
    }
    if (doctorName) filter.doctorName = { $regex: doctorName, $options: 'i' };
    if (fromDate || toDate) {
      filter.examinationDate = {};
      if (fromDate) filter.examinationDate.$gte = new Date(fromDate);
      if (toDate)   filter.examinationDate.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const certs = await MedicalCertificate.find(filter)
      .populate('issuedBy', 'name')
      .sort('-createdAt');
    res.json(certs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get One ──────────────────────────────────────────────────────────────────
export const getCertificateById = async (req, res) => {
  try {
    const cert = await MedicalCertificate.findById(req.params.id).populate('issuedBy', 'name');
    if (!cert || cert.isDeleted) return res.status(404).json({ message: 'Certificate not found' });
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update ──────────────────────────────────────────────────────────────────
export const updateCertificate = async (req, res) => {
  try {
    const cert = await MedicalCertificate.findById(req.params.id);
    if (!cert || cert.isDeleted) return res.status(404).json({ message: 'Certificate not found' });

    const {
      patientName, nicOrStudentId, age, gender,
      examinationDate, diagnosis, unfitFromDate, unfitToDate,
      doctorName, slmcNumber, hospitalName, remarks,
    } = req.body;

    if (examinationDate && unfitFromDate && unfitToDate) {
      const examD = new Date(examinationDate);
      const fromD = new Date(unfitFromDate);
      const toD   = new Date(unfitToDate);
      if (fromD > examD || toD < examD) {
        return res.status(400).json({ message: 'Unfit dates must cover the examination date.' });
      }
      if (fromD > toD) {
        return res.status(400).json({ message: '"Unfit From" must be before "Unfit To".' });
      }
    }

    if (slmcNumber && !/^[A-Za-z0-9/-]{3,20}$/.test(slmcNumber)) {
      return res.status(400).json({ message: 'Invalid SLMC registration number format.' });
    }

    Object.assign(cert, {
      patientName: patientName ?? cert.patientName,
      nicOrStudentId: nicOrStudentId ?? cert.nicOrStudentId,
      age: age ?? cert.age,
      gender: gender ?? cert.gender,
      examinationDate: examinationDate ? new Date(examinationDate) : cert.examinationDate,
      diagnosis: diagnosis ?? cert.diagnosis,
      unfitFromDate: unfitFromDate ? new Date(unfitFromDate) : cert.unfitFromDate,
      unfitToDate: unfitToDate ? new Date(unfitToDate) : cert.unfitToDate,
      doctorName: doctorName ?? cert.doctorName,
      slmcNumber: slmcNumber ?? cert.slmcNumber,
      hospitalName: hospitalName ?? cert.hospitalName,
      remarks: remarks ?? cert.remarks,
    });

    await cert.save();
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Soft Delete ──────────────────────────────────────────────────────────────
export const deleteCertificate = async (req, res) => {
  try {
    const cert = await MedicalCertificate.findById(req.params.id);
    if (!cert || cert.isDeleted) return res.status(404).json({ message: 'Certificate not found' });
    cert.isDeleted = true;
    cert.deletedAt = new Date();
    await cert.save();
    res.json({ message: 'Certificate deleted (soft)' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Summary ──────────────────────────────────────────────────────────────────
export const getCertificateSummary = async (req, res) => {
  try {
    const total = await MedicalCertificate.countDocuments({ isDeleted: false });

    // Per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const perMonth = await MedicalCertificate.aggregate([
      { $match: { isDeleted: false, createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Top diagnoses
    const topDiagnoses = await MedicalCertificate.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$diagnosis', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({ total, perMonth, topDiagnoses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
