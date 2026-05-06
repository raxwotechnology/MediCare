import Audit from '../models/Audit.js';

export const getAuditLogs = async (req, res) => {
  try {
    const { role, entity, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (entity) filter.entity = entity;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + 'T23:59:59');
    }

    const total = await Audit.countDocuments(filter);
    const logs = await Audit.find(filter)
      .populate('user', 'name role')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
