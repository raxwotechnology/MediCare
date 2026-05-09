import Audit from '../models/Audit.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Service from '../models/Service.js';
import Employee from '../models/Employee.js';
import Appointment from '../models/Appointment.js';
import DoctorPayment from '../models/DoctorPayment.js';

/**
 * Resolve a raw req.body into a human-readable details snapshot.
 * All IDs are looked up and replaced with names so audit records remain
 * meaningful even after the referenced records are deleted.
 */
async function buildDetails(action, body, params, responseData) {
  try {
    switch (action) {

      /* ── Users ─────────────────────────────────────────────── */
      case 'CREATE_USER':
        return {
          name: body.name,
          role: body.role,
          email: body.email || null,
          phone: body.phone || null,
        };

      case 'UPDATE_USER': {
        const user = await User.findById(params.id).select('name role email phone').lean();
        return {
          targetUser: user?.name || params.id,
          role: user?.role,
          changes: {
            name: body.name || null,
            email: body.email || null,
            phone: body.phone || null,
            passwordChanged: !!body.password,
          },
        };
      }

      case 'TOGGLE_USER': {
        const user = await User.findById(params.id).select('name role isActive').lean();
        return {
          targetUser: user?.name || params.id,
          role: user?.role,
          newStatus: user ? (!user.isActive ? 'activated' : 'deactivated') : 'unknown',
        };
      }

      /* ── Doctors ───────────────────────────────────────────── */
      case 'CREATE_DOCTOR':
        return {
          name: body.name,
          phone: body.phone,
          specialization: body.specialization || null,
          slmcNumber: body.slmcNumber || null,
        };

      case 'UPDATE_DOCTOR': {
        const doctor = await DoctorProfile.findById(params.id).select('name phone specialization').lean();
        return {
          doctor: doctor?.name || params.id,
          phone: doctor?.phone,
          changes: {
            name: body.name || null,
            specialization: body.specialization || null,
            slmcNumber: body.slmcNumber || null,
            phone: body.phone || null,
          },
        };
      }

      case 'UPDATE_DOCTOR_AVAILABILITY': {
        const doctor = await DoctorProfile.findById(params.id).select('name').lean();
        return {
          doctor: doctor?.name || params.id,
          slots: (body.availability || []).map(s => `${s.day} ${s.startTime}–${s.endTime}`),
        };
      }

      case 'ADD_SERVICE_TO_DOCTOR': {
        const [doctor, service] = await Promise.all([
          DoctorProfile.findById(params.id).select('name').lean(),
          Service.findById(body.serviceId).select('name').lean(),
        ]);
        return {
          doctor: doctor?.name || params.id,
          service: service?.name || body.serviceId,
          price: body.price,
          doctorFee: body.doctorFee,
        };
      }

      case 'UPDATE_SERVICE_IN_DOCTOR': {
        const [doctor, service] = await Promise.all([
          DoctorProfile.findById(params.id).select('name').lean(),
          Service.findById(params.serviceId).select('name').lean(),
        ]);
        return {
          doctor: doctor?.name || params.id,
          service: service?.name || params.serviceId,
          newPrice: body.price,
          newDoctorFee: body.doctorFee,
        };
      }

      case 'REMOVE_SERVICE_FROM_DOCTOR': {
        const [doctor, service] = await Promise.all([
          DoctorProfile.findById(params.id).select('name').lean(),
          Service.findById(params.serviceId).select('name').lean(),
        ]);
        return {
          doctor: doctor?.name || params.id,
          service: service?.name || params.serviceId,
        };
      }

      /* ── Services ──────────────────────────────────────────── */
      case 'CREATE_SERVICE':
        return {
          name: body.name,
          price: body.price,
          description: body.description || null,
        };

      case 'UPDATE_SERVICE': {
        const service = await Service.findById(params.id).select('name').lean();
        return {
          service: service?.name || params.id,
          changes: { name: body.name || null, price: body.price || null, description: body.description || null },
        };
      }

      case 'DELETE_SERVICE': {
        const service = await Service.findById(params.id).select('name').lean();
        return { service: service?.name || params.id };
      }

      /* ── Appointments ──────────────────────────────────────── */
      case 'CREATE_APPOINTMENT': {
        const [doctor, service] = await Promise.all([
          DoctorProfile.findById(body.doctorId || body.doctor).select('name').lean(),
          Service.findById(body.serviceId || body.service).select('name').lean(),
        ]);
        return {
          patient: body.patientName,
          phone: body.patientPhone,
          doctor: doctor?.name || body.doctorId || body.doctor,
          service: service?.name || body.serviceId || body.service,
          date: body.appointmentDate,
          price: body.price,
        };
      }

      case 'MARK_PAID': {
        const appt = await Appointment.findById(params.id).select('patientName patientPhone price serviceName').lean();
        return {
          patient: appt?.patientName || params.id,
          phone: appt?.patientPhone,
          service: appt?.serviceName,
          amount: body.totalPaid || body.amount || appt?.price,
          paymentMethod: body.paymentMethod || (body.splits ? body.splits.map(s => `${s.method}: ${s.amount}`).join(', ') : null),
        };
      }

      case 'CANCEL_APPOINTMENT': {
        const appt = await Appointment.findById(params.id).select('patientName patientPhone appointmentDate serviceName doctorName').lean();
        return {
          patient: appt?.patientName || params.id,
          phone: appt?.patientPhone,
          doctor: appt?.doctorName,
          service: appt?.serviceName,
          date: appt?.appointmentDate,
        };
      }

      case 'DELETE_APPOINTMENT': {
        const appt = await Appointment.findById(params.id).select('patientName patientPhone appointmentDate serviceName doctorName status').lean();
        return {
          patient: appt?.patientName || params.id,
          phone: appt?.patientPhone,
          doctor: appt?.doctorName,
          service: appt?.serviceName,
          date: appt?.appointmentDate,
          status: appt?.status,
        };
      }

      case 'ACCEPT_PATIENT': {
        const appt = await Appointment.findById(params.id).select('patientName appointmentDate serviceName').lean();
        return { patient: appt?.patientName || params.id, date: appt?.appointmentDate, service: appt?.serviceName };
      }

      case 'COMPLETE_PATIENT': {
        const appt = await Appointment.findById(params.id).select('patientName appointmentDate serviceName doctorName').lean();
        return {
          patient: appt?.patientName || params.id,
          doctor: appt?.doctorName,
          service: appt?.serviceName,
          date: appt?.appointmentDate,
          notes: body.notes || null,
        };
      }

      case 'ADD_PRESCRIPTION': {
        const appt = await Appointment.findById(params.id).select('patientName doctorName').lean();
        return {
          patient: appt?.patientName || params.id,
          doctor: appt?.doctorName,
          prescription: body.prescription || null,
          medicines: (body.prescribedMedicines || []).map(m => `${m.name}${m.dosage ? ' – ' + m.dosage : ''}${m.quantity ? ' x' + m.quantity : ''}`),
        };
      }

      case 'ADD_PHARMACY_BILL': {
        const appt = await Appointment.findById(params.id).select('patientName patientPhone').lean();
        return {
          patient: appt?.patientName || params.id,
          phone: appt?.patientPhone,
          medicines: (body.medicines || []).map(m => `${m.name} x${m.quantity} @ LKR ${m.price}`),
          totalAmount: body.totalAmount,
        };
      }

      case 'PAY_PHARMACY_BILL': {
        const appt = await Appointment.findById(params.id).select('patientName patientPhone').lean();
        return {
          patient: appt?.patientName || params.id,
          phone: appt?.patientPhone,
          amount: body.totalPaid || body.amount,
          paymentMethod: body.paymentMethod || (body.splits ? body.splits.map(s => `${s.method}: ${s.amount}`).join(', ') : null),
        };
      }

      case 'ADD_EXTRA_CHARGE': {
        const [appt, service] = await Promise.all([
          Appointment.findById(params.id).select('patientName').lean(),
          Service.findById(body.serviceId || body.service).select('name').lean(),
        ]);
        return {
          patient: appt?.patientName || params.id,
          service: service?.name || body.serviceName || body.serviceId,
          price: body.price,
          description: body.description || null,
        };
      }

      case 'PAY_EXTRA_CHARGE': {
        const appt = await Appointment.findById(params.id).select('patientName').lean();
        return {
          patient: appt?.patientName || params.id,
          amount: body.totalPaid || body.amount,
          paymentMethod: body.paymentMethod || (body.splits ? body.splits.map(s => `${s.method}: ${s.amount}`).join(', ') : null),
        };
      }

      case 'DELETE_EXTRA_CHARGE': {
        const appt = await Appointment.findById(params.id).select('patientName').lean();
        return {
          patient: appt?.patientName || params.id,
          chargeId: params.chargeId || null,
        };
      }

      /* ── Employees ─────────────────────────────────────────── */
      case 'CREATE_EMPLOYEE': {
        let name = body.name || null;
        if (!name && body.userId) {
          const user = await User.findById(body.userId).select('name').lean();
          name = user?.name || body.userId;
        }
        return {
          employee: name,
          designation: body.designation,
          monthlySalary: body.monthlySalary,
          hasAccount: body.hasAccount !== false,
        };
      }

      case 'UPDATE_EMPLOYEE': {
        const emp = await Employee.findById(params.id).populate('user', 'name').lean();
        const name = emp?.name || emp?.user?.name || params.id;
        return {
          employee: name,
          changes: {
            designation: body.designation || null,
            monthlySalary: body.monthlySalary || null,
            name: body.name || null,
          },
        };
      }

      case 'DELETE_EMPLOYEE': {
        const emp = await Employee.findById(params.id).populate('user', 'name').lean();
        return {
          employee: emp?.name || emp?.user?.name || params.id,
          designation: emp?.designation,
        };
      }

      case 'PAY_SALARY': {
        const emp = await Employee.findById(params.id).populate('user', 'name').lean();
        return {
          employee: emp?.name || emp?.user?.name || params.id,
          designation: emp?.designation,
          month: body.month,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
        };
      }

      /* ── Doctor Payments ───────────────────────────────────── */
      case 'CREATE_DOCTOR_PAYMENT': {
        const doctor = await DoctorProfile.findById(body.doctorId || body.doctor).select('name').lean();
        return {
          doctor: doctor?.name || body.doctorId || body.doctor,
          amount: body.amount,
          periodStart: body.periodStart || null,
          periodEnd: body.periodEnd || null,
          notes: body.notes || null,
        };
      }

      case 'PAY_DOCTOR': {
        const payment = await DoctorPayment.findById(params.id).select('doctorName amount').lean();
        return {
          doctor: payment?.doctorName || params.id,
          amount: payment?.amount,
          paymentMethod: body.paymentMethod || (body.paymentSplits ? body.paymentSplits.map(s => `${s.method}: ${s.amount}`).join(', ') : null),
          paidAt: new Date().toISOString(),
        };
      }

      case 'DELETE_DOCTOR_PAYMENT': {
        const payment = await DoctorPayment.findById(params.id).select('doctorName amount status').lean();
        return {
          doctor: payment?.doctorName || params.id,
          amount: payment?.amount,
          status: payment?.status,
        };
      }

      /* ── Default: sanitised body (strip passwords, keep readable) ── */
      default: {
        const { password, ...safe } = body || {};
        return Object.keys(safe).length > 0 ? safe : null;
      }
    }
  } catch (err) {
    // If enrichment fails, fall back to a sanitised body snapshot
    const { password, ...safe } = body || {};
    return { ...safe, _enrichmentError: err.message };
  }
}

/* ─────────────────────────────────────────────────────────────
   Middleware factory
   ───────────────────────────────────────────────────────────── */
export const logAction = (action, entity) => async (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = async (data) => {
    if (res.statusCode < 400 && req.user) {
      try {
        const details = await buildDetails(action, req.body, req.params, data);
        await Audit.create({
          user: req.user._id,
          userName: req.user.name,
          role: req.user.role,
          action,
          entity,
          entityId: data?._id || data?.data?._id || data?.employee?._id || req.params?.id,
          details,
          ip: req.ip,
        });
      } catch (e) { /* silent fail — never block the response */ }
    }
    return originalJson(data);
  };

  next();
};
