import express from 'express';
import {
  createWalkInBill, getWalkInBills, getWalkInBillById,
  payWalkInBill, deleteWalkInBill, getWalkInSummary,
} from '../controllers/walkInBillController.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

router.use(protect, authorize('pharmacist', 'admin'));

router.get('/summary', getWalkInSummary);
router.get('/', getWalkInBills);
router.get('/:id', getWalkInBillById);
router.post('/', logAction('CREATE_WALKIN_BILL', 'WalkInBill'), createWalkInBill);
router.patch('/:id/pay', logAction('PAY_WALKIN_BILL', 'WalkInBill'), payWalkInBill);
router.delete('/:id', logAction('DELETE_WALKIN_BILL', 'WalkInBill'), deleteWalkInBill);

export default router;
