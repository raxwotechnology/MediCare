import { useEffect, useState, useMemo } from 'react';
import {
  FiDollarSign, FiCreditCard, FiSmartphone,
  FiPlus, FiTrash2, FiCheckCircle, FiAlertCircle,
  FiBriefcase, FiFileText,
} from 'react-icons/fi';

/* ─────────────────────────────────────────────────────────────────────────────
   Default method set (customer-facing payments — appointments, pharmacy, walk-in)
   For finance/expense flows pass METHODS_EXTENDED via the `methods` prop.
   ──────────────────────────────────────────────────────────────────────────── */
export const PAYMENT_METHODS = [
  { value: 'cash',   label: 'Cash',   icon: FiDollarSign },
  { value: 'card',   label: 'Card',   icon: FiCreditCard },
  { value: 'online', label: 'Online', icon: FiSmartphone },
];

/* Extended set used for Expenses, Extra Income, and Doctor payouts */
export const PAYMENT_METHODS_EXTENDED = [
  { value: 'cash',          label: 'Cash',     icon: FiDollarSign },
  { value: 'card',          label: 'Card',     icon: FiCreditCard },
  { value: 'online',        label: 'Online',   icon: FiSmartphone },
  { value: 'bank_transfer', label: 'Bank Tx',  icon: FiBriefcase },
  { value: 'cheque',        label: 'Cheque',   icon: FiFileText },
];

const findMethod = (m, list) => list.find(x => x.value === m);
const methodLabel = (m, list = PAYMENT_METHODS_EXTENDED) =>
  findMethod(m, list)?.label || m;

/* ─────────────────────────────────────────────────────────────────────────────
   <SplitPaymentInput />
   Each split row's `amount` represents what the customer TENDERED via that
   method (e.g. handed over in cash, swiped on card).  Total tendered may
   EXCEED the bill — the difference is shown as "Change to give" (returned
   as cash to the customer).  Total tendered may NOT be less than the bill.

   Props:
     totalDue
     value         — current splits, [{method, amount}, ...]
     onChange(splits)
     accent        — Tailwind colour root, e.g. 'primary' | 'emerald' | 'blue'
     methods       — list to show (default PAYMENT_METHODS).  Use
                     PAYMENT_METHODS_EXTENDED for finance / doctor pages.
     onChangeGiven(changeAmount)
                   — fired with the live computed change owed back to
                     the customer (>= 0)
   ──────────────────────────────────────────────────────────────────────────── */
export default function SplitPaymentInput({
  totalDue,
  value,
  onChange,
  accent = 'primary',
  methods = PAYMENT_METHODS,
  onChangeGiven,
}) {
  const defaultMethod = methods[0]?.value || 'cash';

  const [splits, setSplits] = useState(() => (
    value && value.length > 0
      ? value
      : [{ method: defaultMethod, amount: Number(totalDue || 0) }]
  ));

  // Re-sync if totalDue changes — only auto-update when there's a single row,
  // so multi-row splits don't get clobbered.
  useEffect(() => {
    if (splits.length === 1) {
      const next = [{ method: splits[0].method, amount: Number(totalDue || 0) }];
      setSplits(next);
      onChange?.(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDue]);

  useEffect(() => { onChange?.(splits); /* eslint-disable-next-line */ }, [splits]);

  const totalTendered = useMemo(
    () => splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0),
    [splits]
  );
  const remaining = Number((totalDue - totalTendered).toFixed(2));
  const overpaid  = Number((totalTendered - totalDue).toFixed(2));
  const isBalanced  = Math.abs(remaining) < 0.01;     // exact match
  const isOverpaid  = overpaid > 0.01;                // change is owed
  const isUnderpaid = remaining > 0.01;               // bill not covered yet

  // Notify parent of change owed back, live
  useEffect(() => {
    onChangeGiven?.(isOverpaid ? overpaid : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overpaid, isOverpaid]);

  const updateSplit = (idx, field, val) => {
    setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addSplit = () => {
    const used = new Set(splits.map(s => s.method));
    const nextMethod = methods.find(m => !used.has(m.value))?.value
                    || methods[1]?.value
                    || methods[0]?.value;
    const suggested = remaining > 0 ? remaining : 0;
    setSplits([...splits, { method: nextMethod, amount: suggested }]);
  };

  const removeSplit = (idx) => {
    if (splits.length === 1) return;
    const next = splits.filter((_, i) => i !== idx);
    if (next.length === 1) next[0] = { ...next[0], amount: Number(totalDue || 0) };
    setSplits(next);
  };

  // Quick-fill the active cash row to make the total = bill (no change).
  // If there's no cash row, we can't auto-balance.
  const fillExact = () => {
    if (!isOverpaid && !isUnderpaid) return;
    const cashIdx = splits.findIndex(s => s.method === 'cash');
    if (cashIdx < 0) return;
    const otherTotal = splits.reduce(
      (s, x, i) => i === cashIdx ? s : s + (parseFloat(x.amount) || 0),
      0
    );
    const exactCash = Math.max(0, Number((totalDue - otherTotal).toFixed(2)));
    setSplits(prev => prev.map((s, i) => i === cashIdx ? { ...s, amount: exactCash } : s));
  };

  const accentText = `text-${accent}-700`;
  const accentBg   = `bg-${accent}-50`;
  const accentBdr  = `border-${accent}-500`;
  const accentBg600 = `bg-${accent}-600`;

  // Decide grid columns for the single-method fast-path
  const fastGridCols = methods.length <= 3 ? 'grid-cols-3'
                     : methods.length === 4 ? 'grid-cols-4'
                     : 'grid-cols-5';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">
          Payment Method{splits.length > 1 ? 's' : ''}
          <span className="ml-2 text-[11px] font-medium text-gray-400">
            (tendered amount per method)
          </span>
        </p>
        {splits.length === 1 ? (
          <button type="button" onClick={addSplit}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <FiPlus size={12} /> Split payment
          </button>
        ) : (
          <button type="button" onClick={addSplit}
            disabled={splits.length >= methods.length}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <FiPlus size={12} /> Add method
          </button>
        )}
      </div>

      {/* Single-payment fast path */}
      {splits.length === 1 && (
        <>
          <div className={`grid ${fastGridCols} gap-2`}>
            {methods.map(m => (
              <button key={m.value} type="button"
                onClick={() => updateSplit(0, 'method', m.value)}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-xs font-medium
                  ${splits[0].method === m.value
                    ? `${accentBdr} ${accentBg} ${accentText}`
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'}`}>
                <m.icon size={16} />{m.label}
              </button>
            ))}
          </div>
          {/* Tendered amount input — defaults to bill total but editable */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">LKR</span>
            <input type="number" min="0" step="0.01" inputMode="decimal"
              placeholder={Number(totalDue).toFixed(2)}
              value={splits[0].amount}
              onChange={e => updateSplit(0, 'amount', e.target.value)}
              className="input-field pl-12 text-sm w-full font-bold tabular-nums" />
          </div>
        </>
      )}

      {/* Split mode: a row per method */}
      {splits.length > 1 && (
        <div className="space-y-2">
          {splits.map((s, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select
                value={s.method}
                onChange={e => updateSplit(i, 'method', e.target.value)}
                className="input-field col-span-5 text-sm">
                {methods.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <div className="relative col-span-6">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">LKR</span>
                <input type="number" min="0" step="0.01"
                  value={s.amount}
                  onChange={e => updateSplit(i, 'amount', e.target.value)}
                  className="input-field pl-12 text-sm w-full" />
              </div>
              <button type="button"
                onClick={() => removeSplit(i)}
                className="col-span-1 text-red-400 hover:text-red-600 text-center p-1">
                <FiTrash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Status + change indicator */}
      <div className="space-y-2">
        {/* Bill total + tendered total */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span className="font-medium uppercase tracking-wider">Bill</span>
          <span className="font-bold tabular-nums text-gray-700">LKR {Number(totalDue).toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span className="font-medium uppercase tracking-wider">Tendered</span>
          <span className="font-bold tabular-nums text-gray-700">LKR {totalTendered.toFixed(2)}</span>
        </div>

        {/* Status pill */}
        {isUnderpaid && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200">
            <span className="flex items-center gap-2 font-medium">
              <FiAlertCircle size={14} /> Short by
            </span>
            <span className="font-bold tabular-nums">LKR {remaining.toFixed(2)}</span>
          </div>
        )}
        {isBalanced && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="flex items-center gap-2 font-medium">
              <FiCheckCircle size={14} /> Balanced — no change due
            </span>
          </div>
        )}
        {isOverpaid && (
          <div className={`flex items-center justify-between rounded-xl px-3 py-3 border-2 ${accentBdr} ${accentBg}`}>
            <span className={`flex items-center gap-2 font-bold text-sm ${accentText}`}>
              <FiDollarSign size={16} /> Change to give back
            </span>
            <span className={`font-black text-xl tabular-nums ${accentText}`}>
              LKR {overpaid.toFixed(2)}
            </span>
          </div>
        )}

        {/* Auto-balance button — only useful when we have a cash row to absorb */}
        {!isBalanced && splits.some(s => s.method === 'cash') && (
          <button type="button" onClick={fillExact}
            className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 underline w-full text-right">
            ↺ Reset cash row for exact change
          </button>
        )}
      </div>
    </div>
  );
}

/** Pure helper — describe a splits array as a short readable string. */
export const formatSplits = (splits = [], legacyMethod = '') => {
  if (!splits || splits.length === 0) return legacyMethod || '';
  if (splits.length === 1) return methodLabel(splits[0].method);
  return splits
    .map(s => `${methodLabel(s.method)} LKR ${Number(s.amount).toFixed(2)}`)
    .join(' + ');
};
