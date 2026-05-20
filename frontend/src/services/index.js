import api from './api';

// Auth
export const authService = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Users (admin)
export const userService = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  toggle: (id) => api.patch(`/users/${id}/toggle`),
};

// Doctors
export const doctorService = {
  getAll: () => api.get('/doctors'),
  getPublic: () => api.get('/doctors/public'),
  getLean: () => api.get('/doctors/public/lean'), // fast version for booking page
  getById: (id) => api.get(`/doctors/${id}`),
  getMyProfile: () => api.get('/doctors/my-profile'),
  updateAvailability: (id, data) => api.put(`/doctors/${id}/availability`, data),
  getMyStats: (params) => api.get('/doctors/my-stats', { params }),
  create: (data) => api.post('/doctors', data),
  update: (id, data) => api.put(`/doctors/${id}`, data),
  addService: (id, data) => api.post(`/doctors/${id}/services`, data),
  updateService: (id, serviceId, data) => api.put(`/doctors/${id}/services/${serviceId}`, data),
  removeService: (id, serviceId) => api.delete(`/doctors/${id}/services/${serviceId}`),
};

// Services
export const serviceService = {
  getAll: () => api.get('/services'),
  getPublic: () => api.get('/services/public'),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`),
};

// Appointments
export const appointmentService = {
  getAll: (params) => api.get('/appointments', { params }),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  createPublic: (data) => api.post('/appointments/public', data),
  getQueue: (params) => api.get('/appointments/queue', { params }),
  lookupPatient: (phone) => api.get('/appointments/lookup-patient', { params: { phone } }),

  // Payment now accepts { splits: [{ method, amount }], paymentMethod (legacy) }
  markPaid: (id, data) => api.patch(`/appointments/${id}/pay`, data),

  acceptPatient: (id) => api.patch(`/appointments/${id}/accept`),
  completePatient: (id, data) => api.patch(`/appointments/${id}/complete`, data),
  prescribe: (id, data) => api.patch(`/appointments/${id}/prescribe`, data),

  addPharmacyBill: (id, data) => api.patch(`/appointments/${id}/pharmacy-bill`, data),
  payPharmacyBill: (id, data) => api.patch(`/appointments/${id}/pharmacy-bill/pay`, data),

  // Extra services / charges added after the original payment
  addExtraCharge: (id, data) => api.post(`/appointments/${id}/extra-charge`, data),
  payExtraCharge: (id, data) => api.patch(`/appointments/${id}/extra-charge/pay`, data),
  deleteExtraCharge: (id, chargeId) => api.delete(`/appointments/${id}/extra-charge/${chargeId}`),

  // Invoice — record a print event (audit only)
  recordInvoicePrint: (id) => api.patch(`/appointments/${id}/invoice-printed`),

  // Public — patient self-lookup (no auth required)
  checkAppointment: (params) => api.get('/appointments/check', { params }),

  cancel: (id) => api.patch(`/appointments/${id}/cancel`),
  cancelWithRefund: (id, data) => api.patch(`/appointments/${id}/cancel-refund`, data),
  delete: (id) => api.delete(`/appointments/${id}`),
  // Pass { doctorId, excludeCancelled } to filter — used for booking calendars
  getActiveDates: (params) => api.get('/appointments/active-dates', { params }),
  // Public — for the unauthenticated booking page
  getActiveDatesPublic: (doctorId) =>
    api.get('/appointments/active-dates-public', { params: { doctorId } }),
};

// Payments (doctor)
export const paymentService = {
  getAll: (params) => api.get('/payments', { params }),
  getSummary: () => api.get('/payments/summary'),
  create: (data) => api.post('/payments', data),
  markPaid: (id, data) => api.patch(`/payments/${id}/pay`, data),
  delete: (id) => api.delete(`/payments/${id}`),
};

// Pharmacy
export const pharmacyService = {
  getAppointments: (params) => api.get('/pharmacy/appointments', { params }),
  addBill: (id, data) => api.patch(`/pharmacy/appointments/${id}/bill`, data),
  payBill: (id, data) => api.patch(`/pharmacy/appointments/${id}/bill/pay`, data),
};

// Employees
export const employeeService = {
  getAll: () => api.get('/employees'),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  paySalary: (id, data) => api.post(`/employees/${id}/pay-salary`, data),
};

// Reports
export const reportService = {
  getSummary: (params) => api.get('/reports/summary', { params }),
  getServiceReport: (params) => api.get('/reports/service-report', { params }),
  downloadPDF: (params) => api.get('/reports/pdf', { params, responseType: 'blob' }),
  downloadExcel: (params) => api.get('/reports/excel', { params, responseType: 'blob' }),
  downloadCustom: (params) => api.get('/reports/custom', { params, responseType: 'blob' }),
  downloadCategorizedPDF: (params) => api.get('/reports/categorized-pdf', { params, responseType: 'blob' }),
};

// Audit
export const auditService = {
  getLogs: (params) => api.get('/audit', { params }),
};

// Finance
export const financeService = {
  getExpenses: () => api.get('/finance/expenses'),
  createExpense: (data) => api.post('/finance/expenses', data),
  deleteExpense: (id) => api.delete(`/finance/expenses/${id}`),
  getExtraIncome: () => api.get('/finance/income'),
  createExtraIncome: (data) => api.post('/finance/income', data),
  deleteExtraIncome: (id) => api.delete(`/finance/income/${id}`),
};

// Medical Certificates
export const medicalCertificateService = {
  getAll: (params) => api.get('/medical-certificates', { params }),
  getById: (id) => api.get(`/medical-certificates/${id}`),
  getSummary: () => api.get('/medical-certificates/summary'),
  create: (data) => api.post('/medical-certificates', data),
  update: (id, data) => api.put(`/medical-certificates/${id}`, data),
  delete: (id) => api.delete(`/medical-certificates/${id}`),
};

// Insurance Reports
export const insuranceReportService = {
  getAll: (params) => api.get('/insurance-reports', { params }),
  getById: (id) => api.get(`/insurance-reports/${id}`),
  getSummary: () => api.get('/insurance-reports/summary'),
  create: (data) => api.post('/insurance-reports', data),
  update: (id, data) => api.put(`/insurance-reports/${id}`, data),
  updateStatus: (id, data) => api.patch(`/insurance-reports/${id}/status`, data),
  delete: (id) => api.delete(`/insurance-reports/${id}`),
};

// Walk-In Pharmacy Bills
export const walkInBillService = {
  getAll: (params) => api.get('/walkin-bills', { params }),
  getById: (id) => api.get(`/walkin-bills/${id}`),
  getSummary: () => api.get('/walkin-bills/summary'),
  create: (data) => api.post('/walkin-bills', data),
  pay: (id, data) => api.patch(`/walkin-bills/${id}/pay`, data),
  delete: (id) => api.delete(`/walkin-bills/${id}`),
};

// Daily Cashier Reports
export const cashierReportService = {
  submit: (data) => api.post('/cashier-reports/submit', data),
  getAll: (params) => api.get('/cashier-reports', { params }),
  getSummary: (date) => api.get('/cashier-reports/summary', { params: { date } }),
};
