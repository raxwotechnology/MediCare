import WalkInBill from '../models/WalkInBill.js';

const ALLOWED_METHODS = ['cash', 'card', 'online'];

/**
 * Same helper as in appointmentController — duplicated here to avoid
 * cross-module coupling.  Splits is the source of truth; if only a
 * single legacy `paymentMethod` is supplied we treat it as one full split.
 */
const buildPayment = (body, expectedTotal) => {
  let splits = Array.isArray(body.splits) ? body.splits : null;

  if (!splits && body.paymentMethod) {
    splits = [{ method: body.paymentMethod, amount: expectedTotal }];
  }
  if (!splits || splits.length === 0) {
    throw new Error('At least one payment method is required');
  }

  splits = splits
    .map(s => ({ method: String(s.method || '').toLowerCase(), amount: Number(s.amount) }))
    .filter(s => s.amount > 0);

  if (splits.length === 0) throw new Error('Payment amount must be greater than zero');

  for (const s of splits) {
    if (!ALLOWED_METHODS.includes(s.method)) {
      throw new Error(`Invalid payment method: ${s.method}`);
    }
  }

  // Legacy cashTendered support — fold any extra cash into the cash split
  const cashTenderedLegacy = Number(body.cashTendered);
  if (Number.isFinite(cashTenderedLegacy) && cashTenderedLegacy > 0) {
    const cashIdx = splits.findIndex(s => s.method === 'cash');
    if (cashIdx >= 0 && cashTenderedLegacy > splits[cashIdx].amount) {
      splits[cashIdx] = { ...splits[cashIdx], amount: cashTenderedLegacy };
    }
  }

  const totalTendered = splits.reduce((sum, s) => sum + s.amount, 0);

  // Tendered must cover the bill (over is fine, under is not)
  if (totalTendered < expectedTotal - 0.01) {
    throw new Error(`Payment total (LKR ${totalTendered.toFixed(2)}) is less than amount due (LKR ${expectedTotal.toFixed(2)})`);
  }

  const changeGiven = Math.max(0, Number((totalTendered - expectedTotal).toFixed(2)));
  const total = expectedTotal;

  const dominantMethod = [...splits].sort((a, b) => b.amount - a.amount)[0].method;

  const cashSplit = splits.find(s => s.method === 'cash');
  const cashTendered = cashSplit ? cashSplit.amount : 0;

  return { splits, dominantMethod, total, totalTendered, changeGiven, cashTendered };
};

// ── Create ──────────────────────────────────────────────────────────────────
export const createWalkInBill = async (req, res) => {
  try {
    const { customerName, customerPhone, medicines, notes } = req.body;

    if (!medicines || medicines.length === 0) {
      return res.status(400).json({ message: 'At least one medicine item is required.' });
    }

    for (const m of medicines) {
      if (!m.name || m.price == null || m.quantity == null) {
        return res.status(400).json({ message: 'Each medicine must have a name, price, and quantity.' });
      }
    }

    const bill = await WalkInBill.create({
      customerName,
      customerPhone: customerPhone || '',
      medicines,
      notes: notes || '',
      issuedBy: req.user._id,
    });

    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get All (with optional filters) ─────────────────────────────────────────
export const getWalkInBills = async (req, res) => {
  try {
    const { search, fromDate, toDate, isPaid } = req.query;
    const filter = { isDeleted: false };

    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
      ];
    }
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate)   filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z');
    }
    if (isPaid !== undefined && isPaid !== '') {
      filter.isPaid = isPaid === 'true';
    }

    const bills = await WalkInBill.find(filter)
      .populate('issuedBy', 'name')
      .sort('-createdAt');
    res.json(bills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get One ──────────────────────────────────────────────────────────────────
export const getWalkInBillById = async (req, res) => {
  try {
    const bill = await WalkInBill.findById(req.params.id).populate('issuedBy', 'name');
    if (!bill || bill.isDeleted) return res.status(404).json({ message: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Pay Bill (split-payment aware) ───────────────────────────────────────────
export const payWalkInBill = async (req, res) => {
  try {
    const bill = await WalkInBill.findById(req.params.id);
    if (!bill || bill.isDeleted) return res.status(404).json({ message: 'Bill not found' });
    if (bill.isPaid) return res.status(400).json({ message: 'Bill already paid' });

    let payment;
    try {
      payment = buildPayment(req.body, bill.totalAmount);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    bill.isPaid = true;
    bill.paymentSplits = payment.splits;
    bill.paymentMethod = payment.dominantMethod;
    bill.paidAt = new Date();
    bill.cashTendered = payment.cashTendered;
    bill.totalTendered = payment.totalTendered;
    bill.changeGiven  = payment.changeGiven;
    await bill.save();
    res.json(bill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Delete (soft) ────────────────────────────────────────────────────────────
export const deleteWalkInBill = async (req, res) => {
  try {
    const bill = await WalkInBill.findById(req.params.id);
    if (!bill || bill.isDeleted) return res.status(404).json({ message: 'Bill not found' });
    bill.isDeleted = true;
    bill.deletedAt = new Date();
    await bill.save();
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Summary ──────────────────────────────────────────────────────────────────
export const getWalkInSummary = async (req, res) => {
  try {
    const bills = await WalkInBill.find({ isDeleted: false });
    const total = bills.length;
    const totalRevenue = bills.filter(b => b.isPaid).reduce((s, b) => s + b.totalAmount, 0);
    const pending = bills.filter(b => !b.isPaid).length;
    const paid = bills.filter(b => b.isPaid).length;
    res.json({ total, totalRevenue, pending, paid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
