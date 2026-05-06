import Audit from '../models/Audit.js';

export const logAction = (action, entity) => async (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    if (res.statusCode < 400 && req.user) {
      try {
        await Audit.create({
          user: req.user._id,
          userName: req.user.name,
          role: req.user.role,
          action,
          entity,
          entityId: data?._id || data?.data?._id || req.params?.id,
          details: req.body,
          ip: req.ip,
        });
      } catch (e) { /* silent fail */ }
    }
    return originalJson(data);
  };
  next();
};
