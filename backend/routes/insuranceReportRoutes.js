import express from 'express';
import {
  createInsuranceReport, getInsuranceReports, getInsuranceReportById,
  updateInsuranceReport, updateClaimStatus, deleteInsuranceReport, getInsuranceSummary,
} from '../controllers/insuranceReportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

router.use(protect, authorize('admin', 'doctor', 'pharmacist', 'receptionist'));

router.get('/summary', getInsuranceSummary);
router.get('/', getInsuranceReports);
router.get('/:id', getInsuranceReportById);
router.post('/', logAction('CREATE_INSURANCE_REPORT', 'InsuranceReport'), createInsuranceReport);
router.put('/:id', logAction('UPDATE_INSURANCE_REPORT', 'InsuranceReport'), updateInsuranceReport);
router.patch('/:id/status', logAction('UPDATE_CLAIM_STATUS', 'InsuranceReport'), updateClaimStatus);
router.delete('/:id', logAction('DELETE_INSURANCE_REPORT', 'InsuranceReport'), deleteInsuranceReport);

export default router;
