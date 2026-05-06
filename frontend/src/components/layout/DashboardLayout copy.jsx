import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiUsers, FiUser, FiCalendar, FiDollarSign,
  FiFileText, FiActivity, FiList, FiLogOut, FiMenu, FiX,
  FiPackage, FiShield, FiBarChart2, FiBriefcase, FiPlusCircle, FiShoppingCart
} from 'react-icons/fi';

const navByRole = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: FiHome, end: true },
    { to: '/admin/appointments', label: 'Appointments', icon: FiCalendar },
    { to: '/admin/book', label: 'Book Appointment', icon: FiPlusCircle },
    { to: '/receptionist', label: 'Reception Dashboard', icon: FiCalendar },
    { to: '/pharmacist', label: 'Pharmacy', icon: FiPackage },
    { to: '/admin/users', label: 'Users', icon: FiUsers },
    { to: '/admin/doctors', label: 'Doctors', icon: FiUser },
    { to: '/admin/services', label: 'Services', icon: FiList },
    { to: '/admin/employees', label: 'Employees', icon: FiBriefcase },
    { to: '/admin/payments', label: 'Doctor Payments', icon: FiDollarSign },
    { to: '/admin/reports', label: 'Financial Reports', icon: FiBarChart2 },
    { to: '/admin/custom-reports', label: 'Custom Reports', icon: FiFileText },
    { to: '/admin/expenses', label: 'Expenses', icon: FiActivity },
    { to: '/admin/income', label: 'Extra Income', icon: FiDollarSign },
    { to: '/admin/medical-certificates', label: 'Medical Certificates', icon: FiFileText },
    { to: '/admin/insurance-reports', label: 'Insurance Reports', icon: FiActivity },
    { to: '/admin/walkin-bills', label: 'Walk-In Bills', icon: FiShoppingCart },
    { to: '/admin/cashier-reports', label: 'Cashier Reports', icon: FiDollarSign },
    { to: '/admin/audit', label: 'Audit Logs', icon: FiShield },
  ],
  doctor: [
    { to: '/doctor', label: 'Dashboard', icon: FiHome, end: true },
    { to: '/doctor/appointments', label: 'Appointments', icon: FiCalendar },
    { to: '/doctor/earnings', label: 'Earnings', icon: FiDollarSign },
    { to: '/doctor/medical-certificates', label: 'Medical Certificates', icon: FiFileText },
    { to: '/doctor/insurance-reports', label: 'Insurance Reports', icon: FiActivity },
  ],
  patient: [
    { to: '/patient', label: 'Dashboard', icon: FiHome, end: true },
    { to: '/patient/appointments', label: 'My Appointments', icon: FiCalendar },
  ],
  receptionist: [
    { to: '/receptionist', label: 'Dashboard', icon: FiHome, end: true },
    { to: '/receptionist/book', label: 'Book Appointment', icon: FiPlusCircle },
    { to: '/receptionist/appointments', label: 'Queue / Payments', icon: FiCalendar },
    { to: '/receptionist/cashier-reports', label: 'Cashier Report', icon: FiDollarSign },
    { to: '/receptionist/medical-certificates', label: 'Medical Certificates', icon: FiFileText },
    { to: '/receptionist/insurance-reports', label: 'Insurance Reports', icon: FiActivity },
  ],
  pharmacist: [
    { to: '/pharmacist', label: 'Dashboard', icon: FiHome, end: true },
    { to: '/pharmacist/queue', label: 'Pharmacy Queue', icon: FiPackage },
    { to: '/pharmacist/walkin-bills', label: 'Walk-In Bills', icon: FiShoppingCart },
    { to: '/pharmacist/cashier-reports', label: 'Cashier Report', icon: FiDollarSign },
  ],
};

const roleBadgeColor = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-teal-100 text-teal-700',
  patient: 'bg-blue-100 text-blue-700',
  receptionist: 'bg-orange-100 text-orange-700',
  pharmacist: 'bg-green-100 text-green-700',
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = navByRole[user?.role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white w-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-100">
        <div className="w-10 h-10 bg-primary-50 p-1.5 rounded-xl shadow-sm border border-primary-100 flex-shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="MediClinic" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-gray-900 text-lg leading-tight uppercase tracking-wide">MediClinic</p>
          <p className="text-[10px] uppercase font-bold text-primary-500 tracking-widest">Management</p>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <FiX size={20} />
        </button>
      </div>

      {/* User info */}
      <div className="px-5 py-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-2xl flex items-center justify-center font-bold text-white text-base shadow-md shadow-primary-200 flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${roleBadgeColor[user?.role]}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        <p className="px-4 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Main Navigation</p>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${isActive
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-200'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} className={isActive ? 'text-white' : 'text-gray-400'} />
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-4 py-5 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3.5 w-full px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all duration-300"
        >
          <FiLogOut size={19} />
          <span>Logout Session</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-500 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar Overlay (Mobile & Desktop Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-80 bg-white shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.4, 0, 0.2, 1)] transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <Sidebar />
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Unified Top Header */}
        <header className="flex items-center gap-4 px-6 py-4 bg-white border-b border-gray-200 z-40 sticky top-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 -ml-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all duration-300 shadow-sm border border-transparent hover:border-primary-100"
            title="Toggle Sidebar"
          >
            <FiMenu size={24} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white p-1 rounded-xl border border-gray-100 shadow-sm flex items-center justify-center">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-display font-black text-gray-900 tracking-tight text-xl">MediClinic</span>
              <span className="hidden sm:inline-block ml-3 px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded uppercase tracking-widest leading-none">V 2.0</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <p className="text-xs font-bold text-gray-900 leading-none">{user?.name}</p>
              <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">{user?.role}</p>
            </div>
            <div className="w-9 h-9 bg-gray-100 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-gray-600 text-sm overflow-hidden">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dynamic Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/30">
          <div className="max-w-[1600px] mx-auto p-6 md:p-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

