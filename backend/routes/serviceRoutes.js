import express from 'express';
import { createService, getServices, updateService, deleteService } from '../controllers/serviceController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';
const router = express.Router();

router.get('/public', getServices); // public
router.use(protect);
router.get('/', getServices);
router.post('/', authorize('admin'), logAction('CREATE_SERVICE', 'Service'), createService);
router.put('/:id', authorize('admin'), logAction('UPDATE_SERVICE', 'Service'), updateService);
router.delete('/:id', authorize('admin'), logAction('DELETE_SERVICE', 'Service'), deleteService);
export default router;
