import InsuranceReport from '../models/InsuranceReport.js';

// ── Create ──────────────────────────────────────────────────────────────────
export const createInsuranceReport = async (req, res) => {
  try {
    const report = await InsuranceReport.create({
      ...req.body,
      issuedBy: req.user._id,
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get All (with filters) ───────────────────────────────────────────────────
export const getInsuranceReports = async (req, res) => {
  try {
    const { search, insuranceCompany, policyNumber, claimStatus, fromDate, toDate } = req.query;
    const filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { patientName: { $regex: search, $options: 'i' } },
        { nic: { $regex: search, $options: 'i' } },
      ];
    }
    if (policyNumber) filter.policyNumber = { $regex: policyNumber, $options: 'i' };
    if (insuranceCompany) filter.insuranceCompany = { $regex: insuranceCompany, $options: 'i' };
    if (claimStatus) filter.claimStatus = claimStatus;
    if (fromDate || toDate) {
      filter.admissionDate = {};
      if (fromDate) filter.admissionDate.$gte = new Date(fromDate);
      if (toDate)   filter.admissionDate.$lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const reports = await InsuranceReport.find(filter)
      .populate('issuedBy', 'name')
      .sort('-createdAt');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get One ──────────────────────────────────────────────────────────────────
export const getInsuranceReportById = async (req, res) => {
  try {
    const report = await InsuranceReport.findById(req.params.id).populate('issuedBy', 'name');
    if (!report || report.isDeleted) return res.status(404).json({ message: 'Report not found' });
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update ──────────────────────────────────────────────────────────────────
export const updateInsuranceReport = async (req, res) => {
  try {
    const report = await InsuranceReport.findById(req.params.id);
    if (!report || report.isDeleted) return res.status(404).json({ message: 'Report not found' });
    Object.assign(report, req.body);
    await report.save();
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update Claim Status ──────────────────────────────────────────────────────
export const updateClaimStatus = async (req, res) => {
  try {
    const { claimStatus } = req.body;
    const report = await InsuranceReport.findById(req.params.id);
    if (!report || report.isDeleted) return res.status(404).json({ message: 'Report not found' });
    report.claimStatus = claimStatus;
    await report.save();
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Soft Delete ──────────────────────────────────────────────────────────────
export const deleteInsuranceReport = async (req, res) => {
  try {
    const report = await InsuranceReport.findById(req.params.id);
    if (!report || report.isDeleted) return res.status(404).json({ message: 'Report not found' });
    report.isDeleted = true;
    report.deletedAt = new Date();
    await report.save();
    res.json({ message: 'Report deleted (soft)' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Summary ──────────────────────────────────────────────────────────────────
export const getInsuranceSummary = async (req, res) => {
  try {
    const allReports = await InsuranceReport.find({ isDeleted: false });

    const total = allReports.length;
    const totalAmount = allReports.reduce((sum, r) =>
      sum + (r.consultationFee || 0) + (r.labTestCharges || 0) +
      (r.medicineCost || 0) + (r.roomCharges || 0) + (r.otherCharges || 0), 0);

    const byStatus = {
      pending: allReports.filter(r => r.claimStatus === 'pending').length,
      submitted: allReports.filter(r => r.claimStatus === 'submitted').length,
      approved: allReports.filter(r => r.claimStatus === 'approved').length,
      rejected: allReports.filter(r => r.claimStatus === 'rejected').length,
    };

    const approvedAmount = allReports
      .filter(r => r.claimStatus === 'approved')
      .reduce((sum, r) =>
        sum + (r.consultationFee || 0) + (r.labTestCharges || 0) +
        (r.medicineCost || 0) + (r.roomCharges || 0) + (r.otherCharges || 0), 0);

    res.json({ total, totalAmount, byStatus, approvedAmount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
