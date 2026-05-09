import { useState, useEffect } from 'react';
import { auditService } from '../../services';
import { PageHeader, Spinner, EmptyState } from '../../components/common';
import {
  FiShield, FiSearch, FiUser, FiClock, FiGlobe,
  FiTag, FiX, FiChevronRight, FiArrowLeft, FiActivity,
  FiAlertCircle, FiCheckCircle, FiInfo, FiEdit3, FiTrash2, FiPlus
} from 'react-icons/fi';

/* ─── helpers ─────────────────────────────────────────────── */
const actionMeta = (action) => {
  if (!action) return { color: 'badge-gray', icon: FiActivity, bg: 'bg-gray-50', border: 'border-gray-200', label: 'Unknown' };
  if (action.includes('CREATE') || action.includes('ADD'))
    return { color: 'badge-green', icon: FiPlus, bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Create' };
  if (action.includes('DELETE') || action.includes('REMOVE'))
    return { color: 'badge-red', icon: FiTrash2, bg: 'bg-red-50', border: 'border-red-200', label: 'Delete' };
  if (action.includes('UPDATE') || action.includes('EDIT') || action.includes('PAY') || action.includes('COMPLETE') || action.includes('ACCEPT'))
    return { color: 'badge-blue', icon: FiEdit3, bg: 'bg-blue-50', border: 'border-blue-200', label: 'Update' };
  if (action.includes('TOGGLE'))
    return { color: 'badge-yellow', icon: FiAlertCircle, bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Toggle' };
  if (action.includes('LOGIN') || action.includes('AUTH'))
    return { color: 'badge-green', icon: FiCheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Auth' };
  return { color: 'badge-gray', icon: FiActivity, bg: 'bg-gray-50', border: 'border-gray-200', label: 'Action' };
};

const roleColor = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-teal-100 text-teal-700',
  receptionist: 'bg-orange-100 text-orange-700',
  pharmacist: 'bg-green-100 text-green-700',
  patient: 'bg-blue-100 text-blue-700',
};

/* ─── JSON Viewer ──────────────────────────────────────────── */
function JsonViewer({ data, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(depth > 2);

  if (data === null || data === undefined) return <span className="text-gray-400 italic">null</span>;
  if (typeof data === 'boolean') return <span className="text-orange-600 font-mono">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-blue-600 font-mono">{data}</span>;
  if (typeof data === 'string') return <span className="text-emerald-700 font-mono">"{data}"</span>;

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-gray-400 font-mono">[]</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-gray-500 hover:text-gray-700 font-mono text-xs font-semibold bg-gray-100 px-1.5 py-0.5 rounded"
        >
          [{collapsed ? `${data.length} items` : ''}]
          {collapsed ? ' ▶' : ' ▼'}
        </button>
        {!collapsed && (
          <div className="ml-4 border-l-2 border-gray-100 pl-3 mt-1 space-y-1">
            {data.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-gray-300 font-mono text-xs mt-0.5">[{i}]</span>
                <JsonViewer data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="text-gray-400 font-mono">{'{}'}</span>;
    return (
      <span>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-gray-500 hover:text-gray-700 font-mono text-xs font-semibold bg-gray-100 px-1.5 py-0.5 rounded"
        >
          {'{'}
          {collapsed ? `${keys.length} fields` : ''}
          {'}'}
          {collapsed ? ' ▶' : ' ▼'}
        </button>
        {!collapsed && (
          <div className="ml-4 border-l-2 border-gray-100 pl-3 mt-1 space-y-1.5">
            {keys.map((k) => (
              <div key={k} className="flex gap-2 items-start flex-wrap">
                <span className="text-rose-500 font-mono text-xs font-semibold whitespace-nowrap">{k}:</span>
                <JsonViewer data={data[k]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </span>
    );
  }

  return <span className="font-mono text-xs text-gray-700">{String(data)}</span>;
}

/* ─── Audit Detail Modal ─────────────────────────────────── */
function AuditDetailPanel({ log, onClose }) {
  if (!log) return null;
  const meta = actionMeta(log.action);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={`px-6 py-5 rounded-t-2xl ${meta.bg} border-b ${meta.border} flex items-start justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.bg} border ${meta.border}`}>
              <meta.icon size={20} className="text-gray-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-display">{log.action}</h2>
              <p className="text-xs text-gray-500">
                {new Date(log.createdAt).toLocaleString('en-US', {
                  weekday: 'short', year: 'numeric', month: 'short',
                  day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/60 transition-colors">
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

          {/* Who */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                <FiUser size={11} /> Performed By
              </p>
              <p className="font-bold text-gray-900">{log.userName || 'Unknown'}</p>
              <span className={`badge text-xs capitalize mt-1 ${roleColor[log.role] || 'bg-gray-100 text-gray-700'}`}>
                {log.role || '—'}
              </span>
              {log.user && (
                <p className="text-xs text-gray-400 mt-1 font-mono">ID: {log.user._id || log.user}</p>
              )}
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                <FiTag size={11} /> Target Entity
              </p>
              <p className="font-bold text-gray-900">{log.entity || '—'}</p>
              {log.entityId && (
                <p className="text-xs text-gray-400 mt-1 font-mono">
                  #{log.entityId.slice(-10)}
                </p>
              )}
            </div>
          </div>

          {/* IP & Timestamp */}
          <div className="flex flex-wrap gap-3">
            {log.ip && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <FiGlobe size={13} className="text-gray-400" />
                <span className="text-xs text-gray-600 font-mono">{log.ip}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <FiClock size={13} className="text-gray-400" />
              <span className="text-xs text-gray-600 font-mono">{log._id}</span>
            </div>
          </div>

          {/* Details */}
          {log.details && Object.keys(log.details).length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
                <FiInfo size={11} /> Action Details
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-x-auto">
                <div className="text-xs leading-relaxed">
                  <JsonViewer data={log.details} depth={0} />
                </div>
              </div>
            </div>
          )}

          {(!log.details || Object.keys(log.details).length === 0) && (
            <div className="text-center py-4 text-gray-400 text-sm italic">
              No additional details recorded for this action.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm flex items-center gap-2">
            <FiArrowLeft size={14} /> Back to Logs
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function AuditDetail() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ role: '', entity: '', action: '', startDate: '', endDate: '', page: 1 });
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await auditService.getLogs({ ...filters, limit: 50 });
      setLogs(r.data.logs);
      setPagination({ total: r.data.total, pages: r.data.pages });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters.page, filters.role, filters.entity, filters.startDate, filters.endDate]);

  const displayed = search
    ? logs.filter(
        (l) =>
          (l.userName || '').toLowerCase().includes(search.toLowerCase()) ||
          (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
          (l.entity || '').toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  // Quick stats from current page
  const creates = logs.filter((l) => l.action?.includes('CREATE') || l.action?.includes('ADD')).length;
  const updates = logs.filter((l) => l.action?.includes('UPDATE') || l.action?.includes('PAY') || l.action?.includes('COMPLETE')).length;
  const deletes = logs.filter((l) => l.action?.includes('DELETE') || l.action?.includes('REMOVE')).length;

  return (
    <div>
      <PageHeader
        title="Audit Inspector"
        subtitle="Detailed inspection of every user action in the system"
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Records', value: pagination.total, icon: FiShield, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Creates (this page)', value: creates, icon: FiPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Updates (this page)', value: updates, icon: FiEdit3, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Deletes (this page)', value: deletes, icon: FiTrash2, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={20} className={s.color} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="User, action, entity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-8 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX size={13} />
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, page: 1 })} className="input-field text-sm">
              <option value="">All Roles</option>
              {['admin', 'doctor', 'receptionist', 'pharmacist', 'patient'].map((r) => (
                <option key={r} value={r} className="capitalize">{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity</label>
            <select value={filters.entity} onChange={(e) => setFilters({ ...filters, entity: e.target.value, page: 1 })} className="input-field text-sm">
              <option value="">All Entities</option>
              {['Appointment', 'User', 'DoctorProfile', 'Service', 'Employee', 'DoctorPayment', 'Expense', 'ExtraIncome'].map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })} className="input-field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })} className="input-field text-sm" />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">{pagination.total} total records · showing page {filters.page} of {pagination.pages}</p>

      {loading ? (
        <Spinner />
      ) : displayed.length === 0 ? (
        <EmptyState message="No audit logs found" icon={<FiShield size={40} />} />
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP Address</th>
                  <th>Details</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((log) => {
                  const meta = actionMeta(log.action);
                  const hasDetails = log.details && Object.keys(log.details).length > 0;
                  return (
                    <tr
                      key={log._id}
                      className="cursor-pointer hover:bg-primary-50/30 transition-colors"
                      onClick={() => setSelected(log)}
                    >
                      <td>
                        <div>
                          <p className="text-xs font-medium text-gray-700">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold uppercase flex-shrink-0">
                            {(log.userName || '?').charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{log.userName || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge text-xs capitalize ${roleColor[log.role] || 'bg-gray-100 text-gray-700'}`}>
                          {log.role || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge text-xs ${meta.color}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div>
                          <p className="text-sm text-gray-700">{log.entity || '—'}</p>
                          {log.entityId && (
                            <p className="text-xs text-gray-400 font-mono">#{log.entityId.slice(-8)}</p>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-400 font-mono">{log.ip || '—'}</span>
                      </td>
                      <td>
                        {hasDetails ? (
                          <span className="badge badge-blue text-xs">
                            {Object.keys(log.details).length} fields
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <button className="text-gray-400 hover:text-primary-600 transition-colors p-1 flex items-center gap-1 text-xs font-medium">
                          Inspect <FiChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                className="btn-secondary text-sm"
              >
                ← Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {filters.page} of {pagination.pages}
              </span>
              <button
                disabled={filters.page >= pagination.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                className="btn-secondary text-sm"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail panel */}
      {selected && <AuditDetailPanel log={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
