import Employee from '../models/Employee.js';
import User from '../models/User.js';
import SalaryPayment from '../models/SalaryPayment.js';

export const createEmployee = async (req, res) => {
  try {
    const { userId, designation, monthlySalary, name, phone, email, hasAccount } = req.body;

    const useAccount = hasAccount !== false && hasAccount !== 'false';

    if (useAccount) {
      if (!userId) return res.status(400).json({ message: 'User account is required' });
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      const exists = await Employee.findOne({ user: userId });
      if (exists) return res.status(400).json({ message: 'Employee record already exists for this user' });

      const employee = await Employee.create({
        user: userId,
        designation,
        monthlySalary,
        hasAccount: true,
      });
      return res.status(201).json(employee);
    } else {
      // No account employee (e.g. janitor)
      if (!name) return res.status(400).json({ message: 'Name is required for employees without accounts' });
      const employee = await Employee.create({
        user: null,
        name,
        phone: phone || '',
        email: email || '',
        designation,
        monthlySalary,
        hasAccount: false,
      });
      return res.status(201).json(employee);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }).populate('user', 'name email phone role');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getEmployeeById = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id).populate('user', 'name email phone role');
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateEmployee = async (req, res) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteEmployee = async (req, res) => {
  try {
    const emp = await Employee.findByIdAndDelete(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });
    res.json({ message: 'Employee deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const paySalary = async (req, res) => {
  try {
    const { month, amount, paymentMethod } = req.body;
    const emp = await Employee.findById(req.params.id).populate('user');
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    const alreadyPaid = emp.salaryPayments.find(p => p.month === month);
    if (alreadyPaid) return res.status(400).json({ message: `Salary for ${month} already paid` });

    emp.salaryPayments.push({
      month,
      amount,
      paidAt: new Date(),
      paidBy: req.user._id,
      paymentMethod: paymentMethod || 'cash',
    });
    
    await SalaryPayment.create({
      employeeId: emp._id,
      employeeName: emp.hasAccount ? emp.user?.name : emp.name,
      employeeDesignation: emp.designation || (emp.hasAccount ? emp.user?.role : 'Unknown'),
      month,
      amount,
      paidBy: req.user._id,
      paymentMethod: paymentMethod || 'cash',
    });

    await emp.save();
    res.json(emp);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
