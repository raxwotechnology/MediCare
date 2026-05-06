// routes/paymentRoutes.js
import express from 'express';
import { createDoctorPayment, markDoctorPaymentPaid, deleteDoctorPayment, getDoctorPayments, getDoctorEarningsSummary } from '../controllers/paymentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';
const router = express.Router();
router.use(protect);
router.get('/', authorize('admin', 'doctor'), getDoctorPayments);
router.get('/summary', authorize('admin'), getDoctorEarningsSummary);
router.post('/', authorize('admin'), logAction('CREATE_DOCTOR_PAYMENT', 'DoctorPayment'), createDoctorPayment);
router.patch('/:id/pay', authorize('admin'), logAction('PAY_DOCTOR', 'DoctorPayment'), markDoctorPaymentPaid);
router.delete('/:id', authorize('admin'), logAction('DELETE_DOCTOR_PAYMENT', 'DoctorPayment'), deleteDoctorPayment);
export default router;
