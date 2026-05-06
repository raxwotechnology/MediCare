import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiActivity, FiEye, FiEyeOff } from 'react-icons/fi';

const ROLES = [
  { value: 'patient', label: 'Patient', desc: 'Book appointments, view history' },
  { value: 'doctor', label: 'Doctor', desc: 'View appointments, prescribe' },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('patient');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmailRole = ['admin', 'receptionist', 'pharmacist'].includes(role);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const data = { role, name: form.name, password: form.password };
      if (isEmailRole) data.email = form.email;
      else data.phone = form.phone;
      const user = await register(data);
      toast.success('Account created successfully!');
      const routes = { admin: '/admin', doctor: '/doctor', patient: '/patient', receptionist: '/receptionist', pharmacist: '/pharmacist' };
      navigate(routes[user.role] || '/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-clinic-teal flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <FiActivity className="text-white" size={24} />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-white">Create Account</h1>
          <p className="text-primary-200 mt-1">Join MediClinic</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Role selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Register as</label>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(r => (
                <button key={r.value} type="button"
                  onClick={() => setRole(r.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${role === r.value ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-semibold ${role === r.value ? 'text-primary-700' : 'text-gray-700'}`}>{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" placeholder="John Doe" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="input-field" required />
            </div>

            {isEmailRole ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" placeholder="you@clinic.com" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input-field" required />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" placeholder="+94 77 123 4567" value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="input-field" required />
                {role === 'doctor' && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Use the phone number registered by admin</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} placeholder="Min. 6 characters" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="input-field pr-10" required minLength={6} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type={showPw ? 'text' : 'password'} placeholder="Repeat password" value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="input-field" required />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
