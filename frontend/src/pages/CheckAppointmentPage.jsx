import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { appointmentService, doctorService } from '../services';
import {
  FiSearch, FiCalendar, FiPhone, FiUser, FiClock,
  FiCheckCircle, FiXCircle, FiAlertCircle, FiHash,
  FiActivity, FiChevronRight,
} from 'react-icons/fi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotsForDate(doctor, dateStr) {
  if (!doctor?.availability?.length) return [];
  const dayName = DAYS[new Date(dateStr + 'T00:00:00').getDay()];
  return doctor.availability.filter(s => s.day === dayName);
}

function computeSuggestedTime(doctor, dateStr, queueNumber) {
  const slots = getSlotsForDate(doctor, dateStr);
  if (!slots.length || !queueNumber) return null;
  const earliest = slots.reduce((a, b) => (a.startTime < b.startTime ? a : b));
  const [h, m] = earliest.startTime.split(':').map(Number);
  const base = new Date(dateStr + 'T00:00:00');
  base.setHours(h, m + (queueNumber - 1) * 15, 0, 0);
  return base.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

const STATUS_CONFIG = {
  pending: {
    label: 'Awaiting Payment',
    icon: <FiClock size={16} />,
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    card: 'border-amber-300',
    dot: 'bg-amber-400',
  },
  paid: {
    label: 'Paid — Waiting for Doctor',
    icon: <FiCheckCircle size={16} />,
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    card: 'border-blue-400',
    dot: 'bg-blue-400',
  },
  with_doctor: {
    label: 'With Doctor Now',
    icon: <FiActivity size={16} />,
    badge: 'bg-teal-100 text-teal-700 border-teal-200',
    card: 'border-teal-400',
    dot: 'bg-teal-400',
  },
  completed: {
    label: 'Completed',
    icon: <FiCheckCircle size={16} />,
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    card: 'border-emerald-400',
    dot: 'bg-emerald-400',
  },
  cancelled: {
    label: 'Cancelled',
    icon: <FiXCircle size={16} />,
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    card: 'border-gray-300',
    dot: 'bg-gray-300',
  },
};

export default function CheckAppointmentPage() {
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);

  const [form, setForm] = useState({
    phone: '',
    date: new Date().toISOString().split('T')[0],
    doctorId: '',
  });
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null); // null = not searched yet, [] = no results
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setDoctorsLoading(true);
    doctorService.getPublic()
      .then(r => setDoctors(r.data || []))
      .catch(() => { })
      .finally(() => setDoctorsLoading(false));
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!form.phone.trim()) return;
    setSearching(true);
    setError('');
    setResults(null);
    setSearched(false);
    try {
      const params = { phone: form.phone.trim(), date: form.date };
      if (form.doctorId) params.doctorId = form.doctorId;
      const r = await appointmentService.checkAppointment(params);
      setResults(r.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setResults([]);
      } else {
        setError(err.response?.data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handleClear = () => {
    setResults(null);
    setSearched(false);
    setError('');
    setForm(f => ({ ...f, phone: '' }));
  };

  // ── Doctor typeahead ──
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);

  const filteredDoctors = doctors.filter(d => {
    const q = doctorSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.specialization && d.specialization.toLowerCase().includes(q))
    );
  });

  const selectDoctor = (doc) => {
    setForm(f => ({ ...f, doctorId: doc._id }));
    setDoctorSearch(`Dr. ${doc.name}${doc.specialization ? ` — ${doc.specialization}` : ''}`);
    setDoctorDropdownOpen(false);
  };

  const clearDoctor = () => {
    setForm(f => ({ ...f, doctorId: '' }));
    setDoctorSearch('');
    setDoctorDropdownOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-clinic-teal">

      {/* ── Header ── */}
      <div className="px-4 py-5 flex justify-between items-center max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white p-1.5 rounded-xl shadow-lg">
            <img src="/logo.png" alt="MediClinic" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-white text-xl hidden sm:block">MediClinic</span>
        </Link>
        <div className="flex gap-2">
          <Link to="/" className="text-white/80 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/10 transition">
            Book Appointment
          </Link>
          <Link to="/login" className="bg-white text-primary-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-50 transition">
            Login
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-14">

        {/* ── Hero ── */}
        <div className="text-center mb-10 pt-2">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm border border-white/20">
            <FiSearch className="text-white" size={28} />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3">
            Check My Appointment
          </h1>
          <p className="text-primary-100 text-lg max-w-xl mx-auto">
            Enter your phone number and appointment date to see your queue position and suggested arrival time.
          </p>
        </div>

        {/* ── Search card ── */}
        <div className="bg-white rounded-2xl shadow-2xl overflow mb-6">
          <div className="bg-gray-50/60 px-6 py-4 border-b border-gray-100">
            <h2 className="font-display font-bold text-gray-900 text-lg flex items-center gap-2">
              <FiSearch className="text-primary-600" size={18} />
              Find Your Appointment
            </h2>
          </div>

          <form onSubmit={handleSearch} className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="tel"
                    placeholder="07XXXXXXXX"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-gray-900"
                    required
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Appointment Date <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-gray-900"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Doctor filter (optional) — searchable typeahead */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Doctor <span className="text-gray-400 font-normal normal-case">(optional — leave blank to search all)</span>
              </label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={16} />
                <input
                  type="text"
                  placeholder={doctorsLoading ? 'Loading doctors…' : 'Search by name or specialization…'}
                  value={doctorSearch}
                  disabled={doctorsLoading}
                  onChange={e => {
                    setDoctorSearch(e.target.value);
                    setForm(f => ({ ...f, doctorId: '' }));
                    setDoctorDropdownOpen(true);
                  }}
                  onFocus={() => setDoctorDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDoctorDropdownOpen(false), 150)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                  autoComplete="off"
                />
                {/* Right side: spinner while loading, clear X if a doctor is selected */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {doctorsLoading ? (
                    <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  ) : form.doctorId ? (
                    <button
                      type="button"
                      onClick={clearDoctor}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                      tabIndex={-1}
                      title="Clear doctor filter"
                    >
                      <FiXCircle size={16} />
                    </button>
                  ) : null}
                </div>

                {/* Dropdown list */}
                {doctorDropdownOpen && !doctorsLoading && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {filteredDoctors.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-400 text-center">No doctors match your search</div>
                    ) : (
                      <>
                        {/* "All doctors" option */}
                        <button
                          type="button"
                          onMouseDown={() => clearDoctor()}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-b border-gray-100 flex items-center gap-2"
                        >
                          <span className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-400">
                            <FiSearch size={12} />
                          </span>
                          All Doctors
                        </button>
                        {filteredDoctors.map(doc => (
                          <button
                            key={doc._id}
                            type="button"
                            onMouseDown={() => selectDoctor(doc)}
                            className={`w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors flex items-center gap-3
                              ${form.doctorId === doc._id ? 'bg-primary-50' : ''}`}
                          >
                            <span className="w-7 h-7 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs flex-shrink-0">
                              {doc.name.charAt(0)}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block font-semibold text-sm text-gray-900 truncate">Dr. {doc.name}</span>
                              {doc.specialization && (
                                <span className="block text-xs text-gray-400 truncate">{doc.specialization}</span>
                              )}
                            </span>
                            {form.doctorId === doc._id && (
                              <FiCheckCircle size={14} className="text-primary-500 flex-shrink-0" />
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Selected doctor confirmation pill */}
              {form.doctorId && !doctorDropdownOpen && (
                <p className="text-xs text-primary-600 font-semibold mt-1.5 flex items-center gap-1">
                  <FiCheckCircle size={11} /> Filtering by selected doctor
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={searching || !form.phone.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-base transition-all shadow-lg hover:shadow-primary-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {searching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <FiSearch size={18} />
                    Check Appointment
                  </>
                )}
              </button>
              {searched && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-5 py-3.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="bg-white rounded-2xl shadow-xl p-5 mb-6 flex items-start gap-3 border-l-4 border-red-400">
            <FiAlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-700">Something went wrong</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── No results ── */}
        {searched && results !== null && results.length === 0 && !error && (
          <div className="bg-white rounded-2xl shadow-xl p-10 text-center mb-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiCalendar className="text-gray-400" size={28} />
            </div>
            <h3 className="font-display font-bold text-gray-900 text-xl mb-2">No Appointment Found</h3>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              We couldn't find an appointment matching your phone number on <strong>{new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
            </p>
            <p className="text-gray-400 text-xs mt-3">
              Double-check the phone number and date, or contact the clinic for help.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 mt-5 text-primary-600 font-semibold text-sm hover:underline">
              Book a new appointment <FiChevronRight size={14} />
            </Link>
          </div>
        )}

        {/* ── Results ── */}
        {results && results.length > 0 && (
          <div className="space-y-4">
            <p className="text-white/70 text-sm font-medium px-1">
              Found {results.length} appointment{results.length > 1 ? 's' : ''} for {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>

            {results.map(appt => {
              const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
              const doctorObj = appt.doctor && typeof appt.doctor === 'object' ? appt.doctor : null;
              const suggestedTime = doctorObj
                ? computeSuggestedTime(doctorObj, appt.appointmentDate, appt.queueNumber)
                : null;
              const isCancelled = appt.status === 'cancelled';
              const isCompleted = appt.status === 'completed';
              const isActive = ['pending', 'paid', 'with_doctor'].includes(appt.status);

              return (
                <div
                  key={appt._id}
                  className={`bg-white rounded-2xl shadow-xl overflow-hidden border-l-4 ${cfg.card}`}
                >
                  {/* Card header */}
                  <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      {/* Queue badge */}
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold border-2 flex-shrink-0
                        ${appt.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-300'
                          : appt.status === 'with_doctor' ? 'bg-teal-50 text-teal-700 border-teal-300'
                            : appt.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : appt.status === 'cancelled' ? 'bg-gray-50 text-gray-400 border-gray-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        <span className="text-[8px] font-semibold leading-none opacity-60 uppercase">Queue</span>
                        <span className="text-lg leading-tight">#{appt.queueNumber}</span>
                      </div>
                      <div>
                        <p className="font-display font-bold text-gray-900 text-lg leading-tight">{appt.patientName}</p>
                        <p className="text-sm text-gray-500">{form.phone}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-6 space-y-5">

                    {/* Info grid */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiUser className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Doctor</p>
                          <p className="font-semibold text-gray-900">
                            Dr. {doctorObj?.name || appt.doctorName || 'N/A'}
                          </p>
                          {(doctorObj?.specialization) && (
                            <p className="text-xs text-gray-500">{doctorObj.specialization}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiActivity className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Service</p>
                          <p className="font-semibold text-gray-900">
                            {appt.service?.name || appt.serviceName || 'Consultation'}
                          </p>
                          <p className="text-xs text-primary-600 font-bold">LKR {Number(appt.price).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiCalendar className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(appt.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', {
                              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiHash className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Queue Position</p>
                          <p className="font-semibold text-gray-900">Number #{appt.queueNumber}</p>
                          <p className="text-xs text-gray-500">~15 minutes per patient</p>
                        </div>
                      </div>
                    </div>

                    {/* Suggested time banner — only for active appointments */}
                    {isActive && suggestedTime && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                          <FiClock className="text-white" size={22} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Suggested Arrival Time</p>
                          <p className="text-2xl font-display font-black text-emerald-800 leading-tight">{suggestedTime}</p>
                          <p className="text-xs text-emerald-600 mt-0.5">
                            Based on queue #{appt.queueNumber} — please arrive a few minutes early
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pending — instructions */}
                    {appt.status === 'pending' && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                        <FiAlertCircle className="flex-shrink-0 mt-0.5 text-amber-500" size={15} />
                        <span>Please proceed to the reception desk and complete your payment to confirm your visit.</span>
                      </div>
                    )}

                    {/* With doctor */}
                    {appt.status === 'with_doctor' && (
                      <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-800 flex items-start gap-2">
                        <FiActivity className="flex-shrink-0 mt-0.5 text-teal-500" size={15} />
                        <span>You are currently with the doctor. Please wait for your consultation to finish.</span>
                      </div>
                    )}

                    {/* Completed */}
                    {isCompleted && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 flex items-start gap-2">
                        <FiCheckCircle className="flex-shrink-0 mt-0.5 text-emerald-500" size={15} />
                        <span>Your appointment has been completed. We hope you feel better soon!</span>
                      </div>
                    )}

                    {/* Cancelled */}
                    {isCancelled && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 flex items-start gap-2">
                        <FiXCircle className="flex-shrink-0 mt-0.5 text-gray-400" size={15} />
                        <span>This appointment has been cancelled. Please contact the clinic or book a new appointment.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Book another CTA */}
            <div className="text-center pt-2">
              <Link
                to="/"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl transition-all backdrop-blur-sm border border-white/20"
              >
                <FiCalendar size={16} />
                Book Another Appointment
              </Link>
            </div>
          </div>
        )}

        {/* ── Info tip (shown before first search) ── */}
        {!searched && !error && (
          <div className="grid sm:grid-cols-3 gap-4 mt-2">
            {[
              { icon: <FiPhone size={20} />, title: 'Your Phone Number', desc: 'Use the phone number you provided when booking' },
              { icon: <FiCalendar size={20} />, title: 'Appointment Date', desc: 'Select the date your appointment was scheduled for' },
              { icon: <FiClock size={20} />, title: 'Suggested Time', desc: 'We\'ll calculate your ideal arrival based on queue position' },
            ].map((tip, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 text-center">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-white">
                  {tip.icon}
                </div>
                <p className="font-semibold text-white text-sm mb-1">{tip.title}</p>
                <p className="text-white/60 text-xs leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
