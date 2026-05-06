import { useState, useEffect } from 'react';
import { auditService } from '../../services';
import { PageHeader, Spinner, EmptyState } from '../../components/common';
import { FiShield } from 'react-icons/fi';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: '', entity: '', startDate: '', endDate: '', page: 1 });
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const fetch = async () => {
    setLoading(true);
    try {
      const r = await auditService.getLogs({ ...filters, limit: 50 });
      setLogs(r.data.logs); setPagination({ total: r.data.total, pages: r.data.pages });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [filters.page, filters.role, filters.entity, filters.startDate, filters.endDate]);

  const actionColor = (action) => {
    if (action.includes('CREATE')) return 'badge-green';
    if (action.includes('DELETE') || action.includes('TOGGLE')) return 'badge-red';
    if (action.includes('UPDATE') || action.includes('PAY')) return 'badge-blue';
    return 'badge-gray';
  };

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Track all system actions" />

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select value={filters.role} onChange={e => setFilters({ ...filters, role: e.target.value, page: 1 })} className="input-field text-sm">
              <option value="">All</option>
              {['admin', 'doctor', 'receptionist', 'pharmacist', 'patient'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Entity</label>
            <select value={filters.entity} onChange={e => setFilters({ ...filters, entity: e.target.value, page: 1 })} className="input-field text-sm">
              <option value="">All</option>
              {['User', 'Appointment', 'DoctorProfile', 'Service', 'Employee', 'DoctorPayment'].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value, page: 1 })} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value, page: 1 })} className="input-field text-sm" />
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">{pagination.total} records found</p>

      {loading ? <Spinner /> : (
        <>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? <tr><td colSpan={5}><EmptyState message="No logs found" icon={<FiShield size={40} />} /></td></tr>
                  : logs.map(log => (
                    <tr key={log._id}>
                      <td className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="font-medium text-sm">{log.userName || '—'}</td>
                      <td><span className="badge badge-gray capitalize">{log.role}</span></td>
                      <td><span className={`badge text-xs ${actionColor(log.action)}`}>{log.action}</span></td>
                      <td className="text-gray-500 text-xs">{log.entity} {log.entityId ? `#${log.entityId.slice(-6)}` : ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))} className="btn-secondary text-sm">Previous</button>
              <span className="text-sm text-gray-500">Page {filters.page} of {pagination.pages}</span>
              <button disabled={filters.page >= pagination.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} className="btn-secondary text-sm">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
