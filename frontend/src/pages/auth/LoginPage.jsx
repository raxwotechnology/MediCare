import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiMail, FiPhone, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState('email');
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const creds = loginType === 'email'
        ? { email: form.email, password: form.password }
        : { phone: form.phone, password: form.password };
      const user = await login(creds);
      toast.success(`Welcome back, ${user.name}!`);
      const routes = { admin: '/admin', doctor: '/doctor', patient: '/patient', receptionist: '/receptionist', pharmacist: '/pharmacist' };
      navigate(routes[user.role] || '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-clinic-teal flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-white rounded-2xl shadow-lg p-2 flex items-center justify-center">
              <img src="/logo.png" alt="MediClinic" className="w-full h-full object-contain" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-white">MediClinic</h1>
          <p className="text-primary-200 mt-1">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
          {/* Login type toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 mb-6">
            {['email', 'phone'].map(type => (
              <button key={type} type="button"
                onClick={() => setLoginType(type)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${loginType === type ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {type === 'email' ? '📧 Email' : '📱 Phone'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {loginType === 'email' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="email" placeholder="doctor@clinic.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="input-field pl-10" required />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="tel" placeholder="+94 77 123 4567" value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="input-field pl-10" required />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-10 pr-10" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            New patient?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">Create account</Link>
            {' '}or{' '}
            <Link to="/book" className="text-primary-600 font-medium hover:underline">Book without account</Link>
          </p>
        </div>

        <p className="text-center text-primary-200 text-xs mt-6">
          Admin / Staff / Doctor login supported
        </p>
      </div>
    </div>
  );
}
