import { useState, useEffect } from 'react';
import { reportService } from '../../services';
import { PageHeader, StatCard, Spinner } from '../../components/common';
import toast from 'react-hot-toast';
import { FiDownload, FiBarChart2, FiDollarSign, FiActivity, FiShoppingBag, FiCreditCard, FiSmartphone, FiBriefcase, FiFileText } from 'react-icons/fi';

const METHOD_LABELS = {
  cash: 'Cash', card: 'Card', online: 'Online',
  bank_transfer: 'Bank Transfer', cheque: 'Cheque',
};
const METHOD_ICONS = {
  cash: FiDollarSign, card: FiCreditCard, online: FiSmartphone,
  bank_transfer: FiBriefcase, cheque: FiFileText,
};

export default function FinancialReports() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [dates, setDates] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
  });

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const r = await reportService.getSummary(dates);
      setSummary(r.data);
    } catch { toast.error('Failed to load summary'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSummary(); }, []);

  const downloadFile = async (type) => {
    setDownloading(type);
    try {
      const fn = type === 'pdf' ? reportService.downloadPDF : reportService.downloadExcel;
      const res = await fn(dates);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `clinic-report-${dates.startDate}-${dates.endDate}.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded!`);
    } catch { toast.error('Download failed'); }
    finally { setDownloading(''); }
  };

  return (
    <div>
      <PageHeader title="Financial Reports" subtitle="Generate and download financial summaries" />

      {/* Date filter */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">Filters</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" value={dates.startDate} onChange={e => setDates({ ...dates, startDate: e.target.value })} className="input-field" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input type="date" value={dates.endDate} onChange={e => setDates({ ...dates, endDate: e.target.value })} className="input-field" />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={dates.paymentMethod} onChange={e => setDates({ ...dates, paymentMethod: e.target.value })} className="input-field">
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="online">Online</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <button onClick={fetchSummary} disabled={loading} className="btn-primary px-6">
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
        {dates.paymentMethod && (
          <p className="text-xs text-gray-500 mt-3">
            Filter shows records that <strong>used</strong> {METHOD_LABELS[dates.paymentMethod]} (including as part of a split payment).
          </p>
        )}
      </div>

      {loading ? <Spinner /> : summary && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <StatCard icon={FiDollarSign}  label="Appointment Revenue" value={`LKR ${summary.appointmentRevenue?.toLocaleString()}`} color="green" />
            <StatCard icon={FiActivity}    label="Pharmacy Revenue (Linked)" value={`LKR ${summary.pharmacyRevenue?.toLocaleString()}`} color="teal" />
            <StatCard icon={FiShoppingBag} label="Walk-In Revenue" value={`LKR ${summary.walkInRevenue?.toLocaleString() || 0}`} color="emerald" />
            <StatCard icon={FiDollarSign}  label="Extra Income" value={`LKR ${summary.totalExtraIncome?.toLocaleString() || 0}`} color="emerald" />

            <StatCard icon={FiDollarSign} label="Doctor Payouts" value={`LKR ${summary.doctorPaymentsTotal?.toLocaleString()}`} color="orange" />
            <StatCard icon={FiDollarSign} label="Pending Doctor Pay" value={`LKR ${summary.pendingDoctorPayments?.toLocaleString() || 0}`} color="blue" />
            <StatCard icon={FiDollarSign} label="Staff Salaries" value={`LKR ${summary.salaryTotal?.toLocaleString()}`} color="purple" />
            <StatCard icon={FiActivity}   label="General Expenses" value={`LKR ${summary.totalExpenses?.toLocaleString() || 0}`} color="red" />
          </div>

          {/* Income by payment method */}
          {summary.incomeByMethod && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">Income by Payment Method</h3>
                  <p className="text-xs text-gray-500">Net amount per method, change subtracted from cash</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {['cash', 'card', 'online', 'bank_transfer', 'cheque'].map(m => {
                  const v = summary.incomeByMethod[m] || 0;
                  const Icon = METHOD_ICONS[m];
                  const total = Object.values(summary.incomeByMethod).reduce((a, b) => a + (b || 0), 0);
                  const pct = total > 0 ? (v / total) * 100 : 0;
                  return (
                    <div key={m} className={`rounded-xl p-3 border-2 ${v > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={v > 0 ? 'text-emerald-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {METHOD_LABELS[m]}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm tabular-nums">LKR {Number(v).toLocaleString()}</p>
                      {v > 0 && <p className="text-[10px] text-gray-500 mt-0.5">{pct.toFixed(1)}% of income</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Outflows by method */}
          {summary.outflowByMethod && (
            <div className="card mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Outflows by Payment Method
                <span className="text-xs font-normal text-gray-500 ml-2">Doctor payouts + Salaries + Expenses</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {['cash', 'card', 'online', 'bank_transfer', 'cheque'].map(m => {
                  const v = summary.outflowByMethod[m] || 0;
                  const Icon = METHOD_ICONS[m];
                  return (
                    <div key={m} className={`rounded-xl p-3 border-2 ${v > 0 ? 'border-rose-200 bg-rose-50' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon size={14} className={v > 0 ? 'text-rose-600' : 'text-gray-400'} />
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {METHOD_LABELS[m]}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-sm tabular-nums">LKR {Number(v).toLocaleString()}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Net profit */}
          <div className={`card mb-6 border-2 ${summary.netProfit >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Profit</p>
                <p className={`text-3xl font-display font-bold ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  LKR {summary.netProfit?.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {summary.appointmentCount || 0} appointment{summary.appointmentCount === 1 ? '' : 's'} ·
                  {' '}{summary.walkInCount || 0} walk-in bill{summary.walkInCount === 1 ? '' : 's'}
                </p>
              </div>
              <FiBarChart2 className={`${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`} size={48} />
            </div>
          </div>

          {/* Download buttons */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Download Report</h3>
            <p className="text-sm text-gray-500 mb-4">
              Export detailed financial data including appointment payments, pharmacy bills, walk-in pharmacy bills,
              doctor payments, employee salaries, expenses, and per-method breakdowns.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => downloadFile('pdf')} disabled={!!downloading} className="btn-danger flex items-center justify-center gap-2 flex-1">
                <FiDownload size={16} />{downloading === 'pdf' ? 'Generating PDF...' : 'Download PDF Report'}
              </button>
              <button onClick={() => downloadFile('excel')} disabled={!!downloading} className="btn-success flex items-center justify-center gap-2 flex-1">
                <FiDownload size={16} />{downloading === 'excel' ? 'Generating Excel...' : 'Download Excel Report'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
