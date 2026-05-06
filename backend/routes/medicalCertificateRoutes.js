import express from 'express';
import {
  createCertificate, getCertificates, getCertificateById,
  updateCertificate, deleteCertificate, getCertificateSummary,
} from '../controllers/medicalCertificateController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

router.use(protect, authorize('admin', 'doctor', 'pharmacist', 'receptionist'));

router.get('/summary', getCertificateSummary);
router.get('/', getCertificates);
router.get('/:id', getCertificateById);
router.post('/', logAction('CREATE_MEDICAL_CERT', 'MedicalCertificate'), createCertificate);
router.put('/:id', logAction('UPDATE_MEDICAL_CERT', 'MedicalCertificate'), updateCertificate);
router.delete('/:id', logAction('DELETE_MEDICAL_CERT', 'MedicalCertificate'), deleteCertificate);

export default router;
