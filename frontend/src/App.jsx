import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Public
import BookAppointmentPage from './pages/BookAppointmentPage';
import CheckAppointmentPage from './pages/CheckAppointmentPage';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAppointments from './pages/admin/AdminAppointments';
import ManageUsers from './pages/admin/ManageUsers';
import ManageDoctors from './pages/admin/ManageDoctors';
import ManageServices from './pages/admin/ManageServices';
import ManageEmployees from './pages/admin/ManageEmployees';
import DoctorPayments from './pages/admin/DoctorPayments';
import FinancialReports from './pages/admin/FinancialReports';
import AdminCustomReports from './pages/admin/AdminCustomReports';
import FinanceExpenses from './pages/admin/FinanceExpenses';
import FinanceExtraIncome from './pages/admin/FinanceExtraIncome';
import DailyCashierReport from './pages/admin/DailyCashierReport';
import AuditLogs from './pages/admin/AuditLogs';
import AuditDetail from './pages/admin/AuditDetail';
import PatientRecords from './pages/admin/PatientRecords';
import ServiceReport from './pages/admin/ServiceReport';

// Doctor pages
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorEarnings from './pages/doctor/DoctorEarnings';

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard';
import PatientAppointments from './pages/patient/PatientAppointments';

// Receptionist pages
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';
import ReceptionistAppointments from './pages/receptionist/ReceptionistAppointments';
import ReceptionistBookAppointment from './pages/receptionist/ReceptionistBookAppointment';
import ReceptionistDoctors from './pages/receptionist/ReceptionistDoctors';
import ReceptionistServices from './pages/receptionist/ReceptionistServices';
import ReceptionistExpenses from './pages/receptionist/ReceptionistExpenses';
import ReceptionistExtraIncome from './pages/receptionist/ReceptionistExtraIncome';

// Pharmacist pages
import PharmacistDashboard from './pages/pharmacist/PharmacistDashboard';
import PharmacyQueue from './pages/pharmacist/PharmacyQueue';
import PharmacyWalkIn from './pages/pharmacist/PharmacyWalkIn';

// Shared / Other
import MedicalCertificates from './pages/shared/MedicalCertificates';
import InsuranceReports from './pages/shared/InsuranceReports';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
};

const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const routes = { admin: '/admin', doctor: '/doctor', patient: '/patient', receptionist: '/receptionist', pharmacist: '/pharmacist' };
  return <Navigate to={routes[user.role] || '/login'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '10px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '14px' } }} />
        <Routes>
          {/* Public */}
          <Route path="/" element={<BookAppointmentPage />} />
          <Route path="/book" element={<BookAppointmentPage />} />
          <Route path="/check-appointment" element={<CheckAppointmentPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<ManageUsers />} />
            <Route path="appointments" element={<AdminAppointments />} />
            <Route path="doctors" element={<ManageDoctors />} />
            <Route path="services" element={<ManageServices />} />
            <Route path="employees" element={<ManageEmployees />} />
            <Route path="payments" element={<DoctorPayments />} />
            <Route path="reports" element={<FinancialReports />} />
            <Route path="custom-reports" element={<AdminCustomReports />} />
            <Route path="service-report" element={<ServiceReport />} />
            <Route path="expenses" element={<FinanceExpenses />} />
            <Route path="income" element={<FinanceExtraIncome />} />
            <Route path="audit" element={<AuditLogs />} />
            <Route path="audit-detail" element={<AuditDetail />} />
            <Route path="patient-records" element={<PatientRecords />} />
            <Route path="cashier-reports" element={<DailyCashierReport />} />
            <Route path="book" element={<ReceptionistBookAppointment />} />
            <Route path="medical-certificates" element={<MedicalCertificates />} />
            <Route path="insurance-reports" element={<InsuranceReports />} />
            <Route path="walkin-bills" element={<PharmacyWalkIn />} />
          </Route>

          {/* Doctor */}
          <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<DoctorDashboard />} />
            <Route path="appointments" element={<DoctorAppointments />} />
            <Route path="earnings" element={<DoctorEarnings />} />
            <Route path="medical-certificates" element={<MedicalCertificates />} />
            <Route path="insurance-reports" element={<InsuranceReports />} />
          </Route>

          {/* Patient */}
          <Route path="/patient" element={<ProtectedRoute roles={['patient']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<PatientDashboard />} />
            <Route path="appointments" element={<PatientAppointments />} />
          </Route>

          {/* Receptionist */}
          <Route path="/receptionist" element={<ProtectedRoute roles={['receptionist', 'admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<ReceptionistDashboard />} />
            <Route path="appointments" element={<ReceptionistAppointments />} />
            <Route path="book" element={<ReceptionistBookAppointment />} />
            <Route path="cashier-reports" element={<DailyCashierReport />} />
            <Route path="medical-certificates" element={<MedicalCertificates />} />
            <Route path="insurance-reports" element={<InsuranceReports />} />
            <Route path="doctors" element={<ReceptionistDoctors />} />
            <Route path="services" element={<ReceptionistServices />} />
            <Route path="expenses" element={<ReceptionistExpenses />} />
            <Route path="income" element={<ReceptionistExtraIncome />} />
          </Route>

          {/* Pharmacist */}
          <Route path="/pharmacist" element={<ProtectedRoute roles={['pharmacist', 'admin']}><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<PharmacistDashboard />} />
            <Route path="queue" element={<PharmacyQueue />} />
            <Route path="walkin-bills" element={<PharmacyWalkIn />} />
            <Route path="cashier-reports" element={<DailyCashierReport />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
