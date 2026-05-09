import { useState, useEffect } from 'react';
import { employeeService, userService } from '../../services';
import { Modal, PageHeader, Spinner, EmptyState } from '../../components/common';
import toast from 'react-hot-toast';
import { FiPlus, FiDollarSign, FiUser, FiUsers, FiEdit2, FiTrash2 } from 'react-icons/fi';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
];

export default function ManageEmployees() {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [form, setForm] = useState({ userId: '', designation: '', monthlySalary: '', name: '', phone: '', email: '' });
  const [salaryForm, setSalaryForm] = useState({ month: new Date().toISOString().slice(0, 7), amount: '', paymentMethod: 'cash' });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [empRes, usersRes] = await Promise.all([employeeService.getAll(), userService.getAll()]);
    setEmployees(empRes.data);
    setUsers(usersRes.data.filter(u => !['admin', 'patient'].includes(u.role)));
    setLoading(false);
  };
  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setIsEditing(false);
    setSelectedEmp(null);
    setHasAccount(true);
    setForm({ userId: '', designation: '', monthlySalary: '', name: '', phone: '', email: '' });
    setShowCreate(true);
  };

  const openEdit = (emp) => {
    setIsEditing(true);
    setSelectedEmp(emp);
    setHasAccount(emp.hasAccount);
    setForm({
      userId: emp.user?._id || '',
      designation: emp.designation || '',
      monthlySalary: emp.monthlySalary || '',
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || ''
    });
    setShowCreate(true);
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = hasAccount
        ? { userId: form.userId, designation: form.designation, monthlySalary: Number(form.monthlySalary), hasAccount: true }
        : { name: form.name, phone: form.phone, email: form.email, designation: form.designation, monthlySalary: Number(form.monthlySalary), hasAccount: false };
      
      if (isEditing) {
        await employeeService.update(selectedEmp._id, payload);
        toast.success('Employee updated');
      } else {
        await employeeService.create(payload);
        toast.success('Employee added');
      }
      setShowCreate(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee? This will not delete their associated system account, only the employee profile.')) return;
    try {
      await employeeService.delete(id);
      toast.success('Employee deleted');
      fetchData();
    } catch (err) { toast.error('Error deleting employee'); }
  };

  const handleSalary = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await employeeService.paySalary(selectedEmp._id, {
        month: salaryForm.month,
        amount: Number(salaryForm.amount),
        paymentMethod: salaryForm.paymentMethod,
      });
      toast.success('Salary paid!');
      setShowSalary(false);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const existingUserIds = employees.filter(e => e.user).map(e => e.user?._id);

  const getEmpName = (emp) => emp?.hasAccount ? emp.user?.name : emp?.name;
  const getEmpContact = (emp) => emp?.hasAccount ? (emp.user?.email || emp.user?.phone) : (emp?.phone || emp?.email || '—');
  const getEmpRole = (emp) => emp?.hasAccount ? emp.user?.role : 'No Account';

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage staff and monthly salary payments"
        action={<button onClick={openCreate} className="btn-primary flex items-center gap-2"><FiPlus size={16} />Add Employee</button>} />

      {loading ? <Spinner /> : (
        <div className="space-y-3">
          {employees.length === 0 ? <EmptyState message="No employees yet" /> : employees.map(emp => (
            <div key={emp._id} className="card">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${emp.hasAccount ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>
                    {getEmpName(emp)?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{getEmpName(emp)}</p>
                      {!emp.hasAccount && <span className="badge badge-gray text-xs">No Account</span>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {emp.designation || getEmpRole(emp)} &bull; {getEmpContact(emp)}
                    </p>
                    <p className="text-sm font-medium text-primary-600">LKR {emp.monthlySalary?.toLocaleString()}/month</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Total Paid</p>
                    <p className="font-bold text-emerald-600">LKR {emp.salaryPayments?.reduce((s, p) => s + p.amount, 0)?.toLocaleString()}</p>
                  </div>
                  <button onClick={() => { setSelectedEmp(emp); setSalaryForm({ month: new Date().toISOString().slice(0, 7), amount: emp.monthlySalary, paymentMethod: 'cash' }); setShowSalary(true); }}
                    className="btn-success flex items-center gap-2 text-sm px-3 py-1.5 h-auto">
                    <FiDollarSign size={15} />Pay Salary
                  </button>
                  <div className="flex border-l border-gray-200 pl-3 gap-1">
                    <button onClick={() => openEdit(emp)} className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                      <FiEdit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(emp._id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {emp.salaryPayments?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Payment History</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {emp.salaryPayments.slice(-8).map((p, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        <p className="text-gray-500">{p.month}</p>
                        <p className="font-semibold text-gray-800">LKR {p.amount?.toLocaleString()}</p>
                        <p className="text-gray-400 capitalize">{p.paymentMethod?.replace('_', ' ')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Employee Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={isEditing ? 'Edit Employee' : 'Add Employee'}>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Account type toggle */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Employee Type</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHasAccount(true)} disabled={isEditing}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${hasAccount ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <FiUser size={16} />Has System Account
              </button>
              <button type="button" onClick={() => setHasAccount(false)} disabled={isEditing}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${!hasAccount ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'} ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <FiUsers size={16} />No Account (e.g. Janitor)
              </button>
            </div>
          </div>

          {hasAccount ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select User *</label>
              <select value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="input-field" required disabled={isEditing}>
                <option value="">Select a user account</option>
                {users.filter(u => isEditing ? true : !existingUserIds.includes(u._id)).map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required={!hasAccount} placeholder="e.g. Kamal Perera" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+94 77..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Designation / Role</label>
            <input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} className="input-field" placeholder="e.g. Janitor, Nurse, Security" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (LKR) *</label>
            <input type="number" min="0" value={form.monthlySalary} onChange={e => setForm({ ...form, monthlySalary: e.target.value })} className="input-field" required />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add Employee')}</button>
          </div>
        </form>
      </Modal>

      {/* Pay Salary Modal */}
      <Modal isOpen={showSalary} onClose={() => setShowSalary(false)} title={`Pay Salary — ${getEmpName(selectedEmp)}`} size="sm">
        <form onSubmit={handleSalary} className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-500">Standard Salary</p>
            <p className="text-xl font-bold text-primary-600">LKR {selectedEmp?.monthlySalary?.toLocaleString()}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Month *</label>
            <input type="month" value={salaryForm.month} onChange={e => setSalaryForm({ ...salaryForm, month: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (LKR) *</label>
            <input type="number" min="0" value={salaryForm.amount} onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={salaryForm.paymentMethod} onChange={e => setSalaryForm({ ...salaryForm, paymentMethod: e.target.value })} className="input-field">
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowSalary(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-success flex-1">{saving ? 'Processing...' : 'Confirm Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
