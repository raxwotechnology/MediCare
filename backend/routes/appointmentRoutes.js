import express from 'express';
import {
  createAppointment, getAppointments, getAppointmentById,
  markAsPaid, addPrescription, addPharmacyBill, payPharmacyBill,
  getQueueNumber, lookupPatient, acceptPatient, completePatient,
  cancelAppointment, deleteAppointment, getActiveDates, getActiveDatesPublic,
  addExtraCharge, payExtraCharge, deleteExtraCharge, recordInvoicePrint,
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

// Public routes (guest booking)
router.post('/public', createAppointment);
router.get('/queue', getQueueNumber);
router.get('/lookup-patient', lookupPatient);
// Public — for highlighting booked dates on the public booking calendar
router.get('/active-dates-public', getActiveDatesPublic);

router.use(protect);
router.get('/active-dates', getActiveDates);
router.get('/', getAppointments);
router.post('/', logAction('CREATE_APPOINTMENT', 'Appointment'), createAppointment);
router.get('/:id', getAppointmentById);

router.patch('/:id/pay', authorize('receptionist', 'admin'), logAction('MARK_PAID', 'Appointment'), markAsPaid);
router.patch('/:id/accept', authorize('doctor'), logAction('ACCEPT_PATIENT', 'Appointment'), acceptPatient);
router.patch('/:id/complete', authorize('doctor'), logAction('COMPLETE_PATIENT', 'Appointment'), completePatient);
router.patch('/:id/prescribe', authorize('doctor'), logAction('ADD_PRESCRIPTION', 'Appointment'), addPrescription);

router.patch('/:id/pharmacy-bill', authorize('pharmacist', 'admin'), logAction('ADD_PHARMACY_BILL', 'Appointment'), addPharmacyBill);
router.patch('/:id/pharmacy-bill/pay', authorize('pharmacist', 'admin'), logAction('PAY_PHARMACY_BILL', 'Appointment'), payPharmacyBill);

// Extra charges (additional services after original payment)
router.post('/:id/extra-charge',
  authorize('receptionist', 'admin'),
  logAction('ADD_EXTRA_CHARGE', 'Appointment'),
  addExtraCharge);
router.patch('/:id/extra-charge/pay',
  authorize('receptionist', 'admin'),
  logAction('PAY_EXTRA_CHARGE', 'Appointment'),
  payExtraCharge);
router.delete('/:id/extra-charge/:chargeId',
  authorize('receptionist', 'admin'),
  logAction('DELETE_EXTRA_CHARGE', 'Appointment'),
  deleteExtraCharge);

// Invoice — record a print event (audit only)
router.patch('/:id/invoice-printed',
  authorize('receptionist', 'admin'),
  recordInvoicePrint);

router.patch('/:id/cancel', authorize('admin', 'receptionist'), logAction('CANCEL_APPOINTMENT', 'Appointment'), cancelAppointment);
router.delete('/:id', authorize('admin'), logAction('DELETE_APPOINTMENT', 'Appointment'), deleteAppointment);

export default router;
