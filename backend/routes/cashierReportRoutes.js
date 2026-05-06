import express from 'express';
import { submitReport, getReports, getDailySummary } from '../controllers/cashierReportController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

router.use(protect);

router.post('/submit', authorize('pharmacist', 'receptionist', 'admin'), logAction('SUBMIT_CASHIER_REPORT', 'DailyCashierReport'), submitReport);
router.get('/', authorize('pharmacist', 'receptionist', 'admin'), getReports);
router.get('/summary', authorize('pharmacist', 'receptionist', 'admin'), getDailySummary);

export default router;
