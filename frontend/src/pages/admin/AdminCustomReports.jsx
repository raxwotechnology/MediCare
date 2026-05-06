import { useState } from 'react';
import { reportService } from '../../services';
import { PageHeader } from '../../components/common';
import toast from 'react-hot-toast';
import { FiDownload, FiCalendar } from 'react-icons/fi';

export default function AdminCustomReports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const res = await reportService.downloadCustom({ startDate, endDate });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'custom-management-report.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Excel Report generated successfully');
    } catch (err) {
      toast.error('Failed to generate Excel report');
    } finally {
      setLoading(false);
    }
  };

  const handlePDFDownload = async (type) => {
    try {
      setLoading(type);
      const res = await reportService.downloadCategorizedPDF({ type, startDate, endDate });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} PDF generated`);
    } catch (err) {
      toast.error('Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'pharmacy',     label: 'Pharmacy (Linked)', desc: 'Bills tied to appointments' },
    { id: 'walkin',       label: 'Walk-In Pharmacy',  desc: 'Standalone pharmacy bills' },
    { id: 'appointments', label: 'Appointments',      desc: 'Patient booking history' },
    { id: 'doctors',      label: 'Doctors',           desc: 'Service fees & pricing' },
    { id: 'employees',    label: 'Employees',         desc: 'Staff details & roles' },
    { id: 'salaries',     label: 'Salaries',          desc: 'Historical payroll logs' },
    { id: 'expenses',     label: 'Expenses',          desc: 'Operational expenditures' },
    { id: 'income',       label: 'Extra Income',      desc: 'Miscellaneous revenue' },
  ];

  return (
    <div className="pb-10">
      <PageHeader
        title="Custom Management Reports"
        subtitle="Generate detailed reports for clinic operations."
      />

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Date Selector & Excel Column */}
        <div className="xl:col-span-1 space-y-6">
          <div className="card">
            <h3 className="font-display font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FiCalendar className="text-primary-500" />
              1. Select Date Range
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field h-11" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field h-11" />
              </div>
            </div>
          </div>

          <div className="card bg-blue-600 border-none shadow-xl shadow-blue-100">
            <h3 className="text-white font-display font-bold mb-2">Full Management Audit</h3>
            <p className="text-blue-100 text-sm mb-6">Download all categories combined in a single high-fidelity Excel file with separate sheets — including walk-in pharmacy bills with split-payment breakdowns.</p>

            <button
              onClick={handleDownload}
              disabled={!!loading}
              className="w-full bg-white text-blue-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
            >
              {loading === true ? 'Processing...' : <><FiDownload /> Download Excel (.xlsx)</>}
            </button>
          </div>
        </div>

        {/* Individual PDF Column */}
        <div className="xl:col-span-2">
          <div className="card">
            <h3 className="font-display font-bold text-gray-900 mb-6">2. Individual PDF Reports</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map(cat => (
                <div key={cat.id} className="p-4 rounded-2xl border border-gray-100 hover:border-primary-100 bg-gray-50/50 flex items-center justify-between group transition-all">
                  <div>
                    <h4 className="font-bold text-gray-900">{cat.label}</h4>
                    <p className="text-xs text-gray-400">{cat.desc}</p>
                  </div>
                  <button
                    onClick={() => handlePDFDownload(cat.id)}
                    disabled={!!loading}
                    className="p-3 bg-white text-primary-600 rounded-xl shadow-sm border border-gray-100 hover:bg-primary-600 hover:text-white transition-all disabled:opacity-50"
                    title="Download PDF"
                  >
                    {loading === cat.id ? <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /> : <FiDownload size={18} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
