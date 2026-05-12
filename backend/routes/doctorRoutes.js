import express from 'express';
import {
  createDoctor, getDoctors, getDoctorsLean, getDoctorById, updateDoctor,
  addServiceToDoctor, removeServiceFromDoctor, updateServiceInDoctor, getMyDoctorProfile, getDoctorStats,
  updateAvailability
} from '../controllers/doctorController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';
const router = express.Router();

router.get('/public', getDoctors); // public for appointment booking (full data)
router.get('/public/lean', getDoctorsLean); // lean version for booking page speed
router.use(protect);
router.get('/my-profile', authorize('doctor'), getMyDoctorProfile);
router.get('/my-stats', authorize('doctor'), getDoctorStats);
router.get('/', authorize('admin', 'receptionist', 'doctor', 'pharmacist'), getDoctors);
router.post('/', authorize('admin', 'receptionist'), logAction('CREATE_DOCTOR', 'DoctorProfile'), createDoctor);
router.get('/:id', authorize('admin', 'receptionist', 'doctor'), getDoctorById);
router.put('/:id', authorize('admin', 'receptionist'), logAction('UPDATE_DOCTOR', 'DoctorProfile'), updateDoctor);
router.put('/:id/availability', authorize('admin', 'receptionist'), logAction('UPDATE_DOCTOR_AVAILABILITY', 'DoctorProfile'), updateAvailability);
router.post('/:id/services', authorize('admin', 'receptionist'), logAction('ADD_SERVICE_TO_DOCTOR', 'DoctorProfile'), addServiceToDoctor);
router.put('/:id/services/:serviceId', authorize('admin', 'receptionist'), logAction('UPDATE_SERVICE_IN_DOCTOR', 'DoctorProfile'), updateServiceInDoctor);
router.delete('/:id/services/:serviceId', authorize('admin', 'receptionist'), logAction('REMOVE_SERVICE_FROM_DOCTOR', 'DoctorProfile'), removeServiceFromDoctor);
export default router;

