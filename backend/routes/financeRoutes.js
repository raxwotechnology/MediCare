import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getExpenses, createExpense, deleteExpense,
  getExtraIncome, createExtraIncome, deleteExtraIncome
} from '../controllers/financeController.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'receptionist'));

router.get('/expenses', getExpenses);
router.post('/expenses', createExpense);
router.delete('/expenses/:id', deleteExpense);

router.get('/income', getExtraIncome);
router.post('/income', createExtraIncome);
router.delete('/income/:id', deleteExtraIncome);

export default router;
