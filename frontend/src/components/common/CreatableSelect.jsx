import { useState, useRef, useEffect } from 'react';
import { FiPlus, FiSearch, FiX } from 'react-icons/fi';

/**
 * CreatableSelect — a searchable dropdown that also lets the user type a
 * new value when no existing option matches their query.
 *
 * Props:
 *   options      — [{ value, label }]
 *   value        — currently selected value (string)
 *   onChange     — (value, label, isNew) => void
 *                   isNew=true when the user is creating a brand-new entry
 *   placeholder  — string (default "Select or create…")
 *   createLabel  — prefix shown for the "create" option (default "Create")
 *   disabled     — bool
 *   required     — bool (not applied to hidden input; parent form must check)
 *   className    — extra class on the trigger button
 */
export default function CreatableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select or create…',
  createLabel = 'Create',
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Display label of currently selected value
  const selectedLabel = options.find(o => o.value === value)?.label || value || '';

  // Filtered options by query
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  // Whether to show the "create new" option
  const queryTrimmed = query.trim();
  const exactMatch = options.some(o => o.label.toLowerCase() === queryTrimmed.toLowerCase());
  const showCreate = queryTrimmed.length > 0 && !exactMatch;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const select = (optValue, optLabel, isNew = false) => {
    onChange(optValue, optLabel, isNew);
    setOpen(false);
    setQuery('');
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange('', '', false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={openDropdown}
        disabled={disabled}
        className={`input-field flex items-center justify-between text-left w-full ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {selectedLabel && !disabled && (
            <span onClick={clear} className="p-0.5 rounded hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
              <FiX size={12} />
            </span>
          )}
          <FiSearch size={14} className="text-gray-400" />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search or type to create…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">No options found</li>
            )}

            {filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={() => select(o.value, o.label, false)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition ${o.value === value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700'}`}
                >
                  {o.label}
                </button>
              </li>
            ))}

            {showCreate && (
              <li>
                <button
                  type="button"
                  onMouseDown={() => select(`__new__:${queryTrimmed}`, queryTrimmed, true)}
                  className="w-full text-left px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 transition flex items-center gap-2 font-medium border-t border-gray-100"
                >
                  <FiPlus size={14} className="flex-shrink-0" />
                  {createLabel} &ldquo;{queryTrimmed}&rdquo;
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
