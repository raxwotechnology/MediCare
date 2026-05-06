import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { appointmentService, doctorService } from '../services';
import DatePickerWithHighlights from '../components/common/DatePickerWithHighlights';
import toast from 'react-hot-toast';
import { FiActivity, FiSearch, FiCalendar, FiUser, FiPhone, FiHash, FiCheckCircle, FiFilter, FiUserCheck } from 'react-icons/fi';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getSlotsForDate(doctor, dateStr) {
  if (!doctor?.availability || doctor.availability.length === 0) return [];
  const dayName = DAYS[new Date(dateStr + 'T00:00:00').getDay()];
  return doctor.availability.filter(s => s.day === dayName);
}

function getFutureSlotsToday(doctor, dateStr) {
  const slots = getSlotsForDate(doctor, dateStr);
  const now = new Date();

  return slots.filter(slot => {
    const [h, m] = slot.endTime.split(':');
    const slotEnd = new Date(dateStr + 'T00:00:00');
    slotEnd.setHours(parseInt(h), parseInt(m));

    return slotEnd > now; // only future slots
  });
}

function getNextAvailableDays(doctor, fromDate, limit = 3) {
  if (!doctor?.availability || doctor.availability.length === 0) return [];

  const results = [];
  const start = new Date(fromDate + 'T00:00:00');

  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(start);
    checkDate.setDate(start.getDate() + i);

    const dayName = DAYS[checkDate.getDay()];
    const slots = doctor.availability.filter(s => s.day === dayName);

    if (slots.length > 0) {
      results.push({ day: dayName, slots });
    }

    if (results.length === limit) break;
  }

  return results;
}


export default function BookAppointmentPage() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [queueNo, setQueueNo] = useState(null);
  const [form, setForm] = useState({ patientName: '', patientPhone: '', appointmentDate: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(null);
  const [phoneLookup, setPhoneLookup] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [activeDates, setActiveDates] = useState([]);


  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 4;

  useEffect(() => {
    doctorService.getPublic().then(r => setDoctors(r.data)).catch(() => { });
  }, []);

  // Fetch already-booked dates for the selected doctor (public endpoint)
  useEffect(() => {
    if (!selectedDoctor) { setActiveDates([]); return; }
    appointmentService.getActiveDatesPublic(selectedDoctor._id)
      .then(r => setActiveDates(r.data || []))
      .catch(() => setActiveDates([]));
  }, [selectedDoctor]);

  useEffect(() => {
    if (selectedDoctor && form.appointmentDate) {
      appointmentService.getQueue({ doctorId: selectedDoctor._id, date: form.appointmentDate })
        .then(r => setQueueNo(r.data.nextQueue)).catch(() => { });
    }
  }, [selectedDoctor, form.appointmentDate]);

  const handlePhoneLookup = async () => {
    if (!form.patientPhone || form.patientPhone.length < 9) return;
    try {
      const r = await appointmentService.lookupPatient(form.patientPhone);
      if (r.data?.name) {
        setForm(f => ({ ...f, patientName: r.data.name }));
        setPhoneLookup(true);
        toast.success('Patient found!');
      }
    } catch { }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedService) return toast.error('Please select a doctor and service');
    setLoading(true);
    try {
      const r = await appointmentService.createPublic({
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        doctorId: selectedDoctor._id,
        serviceId: selectedService.service._id,
        appointmentDate: form.appointmentDate,
      });
      setBooked(r.data);
      toast.success('Appointment booked!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
        (doc.specialization && doc.specialization.toLowerCase().includes(search.toLowerCase()));
      const matchesSpec = selectedSpec === 'All' || doc.specialization === selectedSpec;
      return matchesSearch && matchesSpec;
    })
    .sort((a, b) => {
      const aSlots = getSlotsForDate(a, form.appointmentDate);
      const bSlots = getSlotsForDate(b, form.appointmentDate);

      const aAvail = !a.availability?.length || aSlots.length > 0;
      const bAvail = !b.availability?.length || bSlots.length > 0;

      if (aAvail && !bAvail) return -1;
      if (!aAvail && bAvail) return 1;

      return a.name.localeCompare(b.name);
    });

  const indexOfLast = currentPage * doctorsPerPage;
  const indexOfFirst = indexOfLast - doctorsPerPage;

  const currentDoctors = filteredDoctors.slice(indexOfFirst, indexOfLast);

  const totalPages = Math.ceil(filteredDoctors.length / doctorsPerPage);

  const specializations = ['All', ...new Set(doctors.map(doc => doc.specialization).filter(Boolean))];

  const isToday = form.appointmentDate === new Date().toISOString().split('T')[0];

  const availabilitySlots = selectedDoctor
    ? getSlotsForDate(selectedDoctor, form.appointmentDate)
    : [];

  const futureSlotsToday = selectedDoctor
    ? getFutureSlotsToday(selectedDoctor, form.appointmentDate)
    : [];

  const hasAvailabilityDefined = selectedDoctor?.availability?.length > 0;

  // 🔥 FINAL LOGIC
  const isAvailableOnDay = !hasAvailabilityDefined || (
    isToday ? futureSlotsToday.length > 0 : availabilitySlots.length > 0
  );

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 to-clinic-teal flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="text-emerald-500" size={32} />
          </div>
          <h2 className="text-2xl font-display font-bold text-gray-900 mb-2">Booked!</h2>
          <p className="text-gray-500 mb-6">Your appointment has been confirmed.</p>
          <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 mb-6">
            <div className="flex justify-between text-sm"><span className="text-gray-500">Queue Number</span><span className="font-bold text-2xl text-primary-600">#{booked.queueNumber}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Patient</span><span className="font-medium">{booked.patientName}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Date</span><span className="font-medium">{booked.appointmentDate}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><span className="font-medium text-primary-600">LKR {booked.price}</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setBooked(null); setSelectedDoctor(null); setSelectedService(null); }} className="btn-secondary flex-1">Book Another</button>
            <Link to="/login" className="btn-primary flex-1 text-center">Login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-700 to-clinic-teal">
      {/* Header */}
      <div className="px-4 py-5 flex justify-between items-center max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white p-1.5 rounded-xl shadow-lg">
            <img src="/logo.png" alt="MediClinic" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-white text-xl hidden sm:block">MediClinic</span>
        </Link>
        <div className="flex gap-2">
          <Link to="/login" className="text-white/80 hover:text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-white/10 transition">Login</Link>
          <Link to="/register" className="bg-white text-primary-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-50 transition">Register</Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-10">
        <div className="text-center mb-10 pt-4">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-3">Book an Appointment</h1>
          <p className="text-primary-100 text-lg">Quality healthcare is just a few clicks away</p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Doctor Selection & Details */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-display font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                  <FiUserCheck className="text-primary-600" />
                  Select a Doctor
                </h3>

                <div className="space-y-4">
                  {/* Search and Filter */}
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search doctor by name or specialty..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm"
                      />
                    </div>
                    <div className="relative">
                      <FiFilter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <select
                        value={selectedSpec}
                        onChange={e => setSelectedSpec(e.target.value)}
                        className="pl-10 pr-8 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm appearance-none bg-white min-w-[160px]"
                      >
                        {specializations.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Specialization Pills (Optional secondary filter) */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {specializations.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSpec(s)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all
                          ${selectedSpec === s ? 'bg-primary-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                <div className="grid sm:grid-cols-2 gap-3">
                  {filteredDoctors.length === 0 && (
                    <div className="col-span-full py-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <FiUser className="text-gray-400" size={24} />
                      </div>
                      <p className="text-gray-500 font-medium">No doctors found match your search</p>
                      <button onClick={() => { setSearch(''); setSelectedSpec('All'); }} className="text-primary-600 text-sm font-semibold mt-2 underline">Clear all filters</button>
                    </div>
                  )}
                  {currentDoctors.map(doc => {
                    const hasSchedule = doc.availability?.length > 0;
                    const isToday = form.appointmentDate === new Date().toISOString().split('T')[0];

                    const slotsToday = getSlotsForDate(doc, form.appointmentDate);
                    const futureSlots = getFutureSlotsToday(doc, form.appointmentDate);

                    const availableToday = !hasSchedule || (
                      isToday ? futureSlots.length > 0 : slotsToday.length > 0
                    );
                    const nextAvailable = getNextAvailableDays(doc, form.appointmentDate);

                    return (
                      <button key={doc._id} type="button"
                        onClick={() => { setSelectedDoctor(doc); setSelectedService(null); }}
                        className={`flex flex-col p-4 rounded-2xl border-2 text-left transition-all
                        ${selectedDoctor?._id === doc._id
                            ? 'border-primary-500 bg-primary-50'
                            : availableToday
                              ? 'border-gray-100 hover:border-primary-200'
                              : 'border-gray-100 opacity-70'}`}>

                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-bold">
                            {doc.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold">Dr. {doc.name}</p>
                            <p className="text-xs text-gray-500">{doc.specialization || 'General'}</p>
                          </div>
                        </div>

                        {/* ✅ AVAILABILITY DISPLAY */}
                        {hasSchedule ? (
                          availableToday ? (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {slotsToday.map((slot, i) => (
                                <span key={i} className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded">
                                  {slot.startTime}–{slot.endTime}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mb-2">
                              <span className="text-xs text-red-500 font-medium">
                                Not available today
                              </span>

                              {/* ✅ NEW PART (THIS IS WHAT YOU WANTED) */}
                              {nextAvailable.length > 0 && (
                                <div className="text-xs text-gray-600 mt-1">
                                  {nextAvailable.map((d, i) => (
                                    <div key={i}>
                                      <span className="font-semibold">{d.day}:</span>{' '}
                                      {d.slots.map((s, idx) =>
                                        `${s.startTime}-${s.endTime}${idx < d.slots.length - 1 ? ', ' : ''}`
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 mb-2">
                            No schedule set
                          </span>
                        )}

                        <span className="text-[11px] text-gray-400 mt-auto">
                          Click to select
                        </span>
                      </button>
                    );
                  })}

                </div>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-2 mb-5">

                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                  >
                    Prev
                  </button>

                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-1 rounded text-sm border
                      ${currentPage === i + 1
                          ? 'bg-primary-600 text-white'
                          : 'bg-white'}`}
                    >
                      {i + 1}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-40"
                  >
                    Next
                  </button>

                </div>
              )}
            </div>

            {selectedDoctor && hasAvailabilityDefined && (
              <div className={`rounded-xl p-3 border text-sm
              ${isAvailableOnDay ? 'bg-teal-50 border-teal-200' : 'bg-amber-50 border-amber-200'}`}>

                {isAvailableOnDay ? (
                  <div>
                    <p className="font-semibold text-teal-800">
                      Dr. {selectedDoctor.name} is available
                    </p>

                    <div className="flex gap-2 flex-wrap mt-1">
                      {(isToday ? futureSlotsToday : availabilitySlots).map((s, i) => (
                        <span key={i} className="text-xs bg-teal-100 px-2 py-1 rounded">
                          {s.startTime} – {s.endTime}
                        </span>
                      ))}
                    </div>

                    {isToday && availabilitySlots.length > futureSlotsToday.length && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Some earlier slots already passed
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-amber-700 font-semibold">
                      Doctor not available at this time
                    </p>

                    {/* NEXT AVAILABLE DAYS */}
                    {(() => {
                      const todayIndex = new Date().getDay();

                      const nextDays = selectedDoctor.availability
                        .map(s => s.day)
                        .filter((day, index, self) => self.indexOf(day) === index)
                        .map(day => {
                          const dayIndex = DAYS.indexOf(day);
                          const diff = (dayIndex - todayIndex + 7) % 7 || 7;

                          const nextDate = new Date();
                          nextDate.setDate(nextDate.getDate() + diff);

                          return {
                            day,
                            date: nextDate.toISOString().split('T')[0],
                            slots: selectedDoctor.availability.filter(s => s.day === day)
                          };
                        })
                        .slice(0, 3);

                      return (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-amber-600 font-medium">
                            Next available:
                          </p>

                          {nextDays.map((d, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-semibold">{d.day}</span> ({d.date})
                              <div className="flex gap-1 flex-wrap mt-1">
                                {d.slots.map((s, j) => (
                                  <span key={j} className="bg-amber-100 px-2 py-0.5 rounded">
                                    {s.startTime}-{s.endTime}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Service Selection for the selected doctor */}
            {selectedDoctor && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden transition-all animate-in fade-in slide-in-from-bottom-4">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                  <h3 className="font-display font-bold text-gray-900 text-lg">Available Services</h3>
                  <div className="text-xs font-semibold text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
                    Dr. {selectedDoctor.name}
                  </div>
                </div>
                <div className="p-6">
                  {selectedDoctor.services.length === 0
                    ? <p className="text-sm text-gray-400 py-4 text-center">No services registered for this doctor yet.</p>
                    : <div className="grid gap-3">
                      {selectedDoctor.services.map(svc => (
                        <button key={svc._id} type="button"
                          onClick={() => setSelectedService(svc)}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all group
                              ${selectedService?._id === svc._id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors
                                ${selectedService?._id === svc._id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-600'}`}>
                              <FiActivity size={16} />
                            </div>
                            <span className="font-semibold text-gray-800">{svc.service?.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="block font-bold text-primary-600">LKR {svc.price.toLocaleString()}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  }
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Booking Form */}
          <div className="lg:col-span-5">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 space-y-6 sticky top-6 border-t-4 border-primary-500">
              <div className="mb-2">
                <h3 className="text-xl font-display font-bold text-gray-900">Patient Details</h3>
                <p className="text-sm text-gray-500">Enter details to confirm your appointment</p>
              </div>

              <div className="space-y-4">
                {/* Date Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">1. Choose Date</label>
                  <DatePickerWithHighlights
                    value={form.appointmentDate}
                    onChange={(iso) => setForm({ ...form, appointmentDate: iso })}
                    highlightedDates={activeDates}
                    min={new Date().toISOString().split('T')[0]}
                    accent="primary"
                    legend="Has bookings"
                    required
                  />
                  {selectedDoctor && activeDates.length > 0 && (
                    <p className="text-[10px] text-gray-500 mt-1.5 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" />
                      Highlighted dates already have bookings for this doctor
                    </p>
                  )}
                  {queueNo && selectedDoctor && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 mt-3 flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-xl font-bold">
                        #{queueNo}
                      </div>
                      <div>
                        <p className="text-xs text-emerald-800 font-bold uppercase tracking-wide">Next Available Queue No</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Auto-assigned for {form.appointmentDate}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Patient lookup/fields */}
                <div className="pt-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">2. Contact Information</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="tel" placeholder="Phone Number" value={form.patientPhone}
                        onChange={e => { setForm({ ...form, patientPhone: e.target.value }); setPhoneLookup(false); }}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium" required />
                    </div>
                    <button
                      type="button"
                      onClick={handlePhoneLookup}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 rounded-xl transition-all flex items-center justify-center font-bold text-xs gap-2 border border-gray-200"
                      title="Lookup existing patient"
                    >
                      <FiSearch size={16} />
                      <span className="hidden sm:inline tracking-widest uppercase">Find</span>
                    </button>
                  </div>
                  {phoneLookup && <p className="text-[10px] text-emerald-600 mt-1.5 font-bold flex items-center gap-1">
                    <FiCheckCircle size={10} /> PATIENT RECORD FOUND AND LOADED
                  </p>}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">3. Patient Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Full Name" value={form.patientName}
                      onChange={e => setForm({ ...form, patientName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium" required />
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              {selectedDoctor && selectedService && (
                <div className="bg-primary-50/50 rounded-2xl p-4 border border-primary-100/50 space-y-3">
                  <p className="text-[10px] font-bold text-primary-800 uppercase tracking-widest text-center border-b border-primary-100 pb-2">Booking Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Doctor</span>
                    <span className="font-bold text-gray-800">Dr. {selectedDoctor.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Service</span>
                    <span className="font-bold text-gray-800">{selectedService.service?.name}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-primary-100">
                    <span className="text-sm font-bold text-primary-800">Total Fee</span>
                    <span className="text-xl font-display font-black text-primary-600">LKR {selectedService.price.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading || !selectedDoctor || !selectedService}
                className={`w-full py-4 rounded-2xl text-white font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-3
                  ${(loading || !selectedDoctor || !selectedService) ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 hover:shadow-primary-200 transform hover:-translate-y-0.5'}`}>
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FiCalendar size={20} />
                    <span>Confirm Appointment</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-xs font-bold text-gray-400 hover:text-primary-600 transition-colors uppercase tracking-widest">
                  Login to manage your medical history →
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
