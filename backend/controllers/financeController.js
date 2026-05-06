import Expense from '../models/Expense.js';
import ExtraIncome from '../models/ExtraIncome.js';

const ALLOWED_METHODS = ['cash', 'card', 'online', 'bank_transfer', 'cheque'];

/* ─────────────────────────────────────────────────────────────────────────────
   Build a clean payment payload for finance records.
   - Accepts either:
       { paymentSplits: [{method, amount}, ...] }
       { paymentMethod: 'cash' }            (legacy single-method)
   - Returns { paymentSplits, paymentMethod, amount }, where:
       * paymentSplits is normalised (numbers, valid methods)
       * paymentMethod = the dominant (largest) split (kept for old reports)
       * amount = sum of splits (use this if caller didn't supply amount)
   - Throws if a method is invalid or splits don't sum to expected amount.
   ──────────────────────────────────────────────────────────────────────────── */
const buildPayment = ({ paymentSplits, paymentMethod }, expectedAmount) => {
  let splits = Array.isArray(paymentSplits) && paymentSplits.length > 0
    ? paymentSplits
    : null;

  // Legacy fallback — single method, full amount
  if (!splits) {
    const m = paymentMethod || 'cash';
    if (!ALLOWED_METHODS.includes(m)) {
      throw new Error(`Invalid payment method: ${m}`);
    }
    splits = [{ method: m, amount: Number(expectedAmount || 0) }];
  }

  // Normalise + validate
  splits = splits.map(s => {
    if (!ALLOWED_METHODS.includes(s.method)) {
      throw new Error(`Invalid payment method: ${s.method}`);
    }
    const amt = Number(s.amount);
    if (Number.isNaN(amt) || amt < 0) {
      throw new Error(`Invalid split amount: ${s.amount}`);
    }
    return { method: s.method, amount: amt };
  });

  const total = splits.reduce((s, x) => s + x.amount, 0);

  if (expectedAmount != null && Math.abs(total - Number(expectedAmount)) > 0.01) {
    throw new Error(
      `Payment splits total (${total.toFixed(2)}) does not match expected amount (${Number(expectedAmount).toFixed(2)})`
    );
  }

  // Dominant method = largest split (ties: first encountered)
  const dominant = splits.reduce((a, b) => (b.amount > a.amount ? b : a)).method;

  return {
    paymentSplits: splits,
    paymentMethod: dominant,
    amount: total,
  };
};

/* ──────────────  EXPENSES  ─────────────── */

export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().populate('recordedBy', 'name').sort('-date');
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { title, description, date, category, amount } = req.body;
    if (!title || !date || amount == null) {
      return res.status(400).json({ message: 'Title, date, and amount are required' });
    }

    const payment = buildPayment(req.body, amount);

    const expense = await Expense.create({
      title,
      description,
      date,
      category,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentSplits: payment.paymentSplits,
      recordedBy: req.user._id,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ──────────────  EXTRA INCOME  ─────────────── */

export const getExtraIncome = async (req, res) => {
  try {
    const income = await ExtraIncome.find().populate('recordedBy', 'name').sort('-date');
    res.json(income);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createExtraIncome = async (req, res) => {
  try {
    const { title, description, date, source, amount } = req.body;
    if (!title || !date || amount == null) {
      return res.status(400).json({ message: 'Title, date, and amount are required' });
    }

    const payment = buildPayment(req.body, amount);

    const income = await ExtraIncome.create({
      title,
      description,
      date,
      source,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentSplits: payment.paymentSplits,
      recordedBy: req.user._id,
    });
    res.status(201).json(income);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const deleteExtraIncome = async (req, res) => {
  try {
    await ExtraIncome.findByIdAndDelete(req.params.id);
    res.json({ message: 'Extra income deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
