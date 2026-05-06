import { useState, useRef, useEffect, useMemo } from 'react';
import {
  format, parse, isValid, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isBefore, isAfter, parseISO, startOfDay,
} from 'date-fns';
import { FiCalendar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toIso = (d) => format(d, 'yyyy-MM-dd');
const parseIso = (s) => {
  if (!s) return null;
  const d = parse(s, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : null;
};

/* ─────────────────────────────────────────────────────────────────────────────
   <DatePickerWithHighlights />
   Drop-in replacement for native <input type="date"> that:
     1. Shows a custom popup calendar (mobile-friendly).
     2. Highlights any dates supplied in the `highlightedDates` array — these
        are the days that already have appointments for the selected doctor.
   ─────────────────────────────────────────────────────────────────────────────
   Props:
     value              — 'YYYY-MM-DD' or '' (controlled)
     onChange(iso)      — fires with the new 'YYYY-MM-DD' string
     highlightedDates   — array of 'YYYY-MM-DD' strings to mark
     min                — optional lower bound 'YYYY-MM-DD'
     max                — optional upper bound 'YYYY-MM-DD'
     placeholder
     className          — extra classes on the input wrapper
     accent             — Tailwind colour root, default 'primary'
     legend             — text shown next to the highlight swatch in the
                          popup, default 'Has appointments'
     disabled
   ──────────────────────────────────────────────────────────────────────────── */
export default function DatePickerWithHighlights({
  value,
  onChange,
  highlightedDates = [],
  min,
  max,
  placeholder = 'Select date',
  className = '',
  accent = 'primary',
  legend = 'Has appointments',
  disabled = false,
  required = false,
}) {
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = parseIso(value);
  const minDate = parseIso(min);
  const maxDate = parseIso(max);

  // Calendar's month-cursor — keeps the calendar opened on the right month.
  const [cursor, setCursor] = useState(selected || new Date());
  useEffect(() => {
    if (selected) setCursor(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const highlightedSet = useMemo(
    () => new Set((highlightedDates || []).filter(Boolean)),
    [highlightedDates]
  );

  const monthDays = useMemo(() => {
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    return eachDayOfInterval({
      start: startOfWeek(first),
      end: endOfWeek(last),
    });
  }, [cursor]);

  const isDisabled = (d) => {
    if (minDate && isBefore(startOfDay(d), startOfDay(minDate))) return true;
    if (maxDate && isAfter(startOfDay(d), startOfDay(maxDate))) return true;
    return false;
  };

  const pick = (d) => {
    if (isDisabled(d)) return;
    onChange?.(toIso(d));
    setOpen(false);
  };

  // Tailwind colour helpers (these strings need to exist somewhere in the
  // codebase or in tailwind.config.js safelist for the build to keep them).
  const accentText  = `text-${accent}-700`;
  const accentBg    = `bg-${accent}-50`;
  const accentBg600 = `bg-${accent}-600`;
  const accentBdr   = `border-${accent}-500`;
  const dotBg       = `bg-${accent}-500`;

  const display = selected ? format(selected, 'EEE, dd MMM yyyy') : '';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`input-field pl-10 text-left w-full font-medium flex items-center
          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
          ${!selected ? 'text-gray-400' : 'text-gray-800'}`}
      >
        <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        {display || placeholder}
      </button>

      {/* Hidden input keeps native form-validation working */}
      {required && (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value || ''}
          onChange={() => {}}
          className="opacity-0 absolute left-0 top-0 h-full w-full pointer-events-none"
        />
      )}

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-72 max-w-[90vw]">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button type="button"
              onClick={() => setCursor(c => subMonths(c, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <FiChevronLeft size={16} />
            </button>
            <p className="font-bold text-sm text-gray-800">
              {format(cursor, 'MMMM yyyy')}
            </p>
            <button type="button"
              onClick={() => setCursor(c => addMonths(c, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
              <FiChevronRight size={16} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-[10px] font-bold text-gray-400 uppercase text-center py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((d, i) => {
              const inMonth = isSameMonth(d, cursor);
              const iso = toIso(d);
              const isHighlighted = highlightedSet.has(iso);
              const isSelected = selected && isSameDay(d, selected);
              const isToday = isSameDay(d, new Date());
              const disabled = isDisabled(d);

              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => pick(d)}
                  disabled={disabled}
                  className={`relative aspect-square text-xs rounded-lg flex items-center justify-center transition-colors
                    ${!inMonth ? 'text-gray-300' : 'text-gray-700'}
                    ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}
                    ${isSelected ? `${accentBg600} text-white font-bold hover:!${accentBg600}` : ''}
                    ${!isSelected && isHighlighted ? `${accentBg} ${accentText} font-bold` : ''}
                    ${!isSelected && isToday ? `ring-1 ${accentBdr}` : ''}
                  `}
                >
                  {format(d, 'd')}
                  {isHighlighted && !isSelected && (
                    <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${dotBg}`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer: legend + clear/today */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-gray-500">
              <span className={`w-2 h-2 rounded-full ${dotBg}`} />
              <span className="font-medium">{legend}</span>
            </div>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => pick(new Date())}
                className={`font-semibold ${accentText} hover:underline`}>
                Today
              </button>
              {selected && (
                <button type="button"
                  onClick={() => { onChange?.(''); setOpen(false); }}
                  className="font-semibold text-gray-400 hover:text-gray-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
