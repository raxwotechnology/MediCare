import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import serviceRoutes from './routes/serviceRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import pharmacyRoutes from './routes/pharmacyRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import medicalCertificateRoutes from './routes/medicalCertificateRoutes.js';
import insuranceReportRoutes from './routes/insuranceReportRoutes.js';
import walkInBillRoutes from './routes/walkInBillRoutes.js';
import cashierReportRoutes from './routes/cashierReportRoutes.js';

dotenv.config();
connectDB();

const app = express();

const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://aayumedicare24.netlify.app'
];
const envOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean);

const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));
app.use(cors({
    origin: (origin, callback) => {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.length === 0 || allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cache-prevention middleware
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/medical-certificates', medicalCertificateRoutes);
app.use('/api/insurance-reports', insuranceReportRoutes);
app.use('/api/walkin-bills', walkInBillRoutes);
app.use('/api/cashier-reports', cashierReportRoutes);

app.get('/', (req, res) => res.json({ message: 'Clinic API Running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
