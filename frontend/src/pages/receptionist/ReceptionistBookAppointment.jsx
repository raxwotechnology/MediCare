import { useState, useEffect } from 'react';
import { appointmentService, doctorService } from '../../services';
import { PageHeader } from '../../components/common';
import DatePickerWithHighlights from '../../components/common/DatePickerWithHighlights';
import toast from 'react-hot-toast';
import { FiSearch, FiUser, FiPhone, FiHash, FiCheckCircle, FiUserCheck } from 'react-icons/fi';

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

// Compute suggested arrival time: firstSlotStart + (queueNo - 1) * 15 minutes
function computeSuggestedTime(doctor, dateStr, queueNumber) {
  const slots = getSlotsForDate(doctor, dateStr);
  if (!slots.length || !queueNumber) return null;
  // Use the earliest slot's start time as the base
  const earliest = slots.reduce((a, b) => (a.startTime < b.startTime ? a : b));
  const [h, m] = earliest.startTime.split(':').map(Number);
  const base = new Date(dateStr + 'T00:00:00');
  base.setHours(h, m + (queueNumber - 1) * 10, 0, 0);
  return base.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
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

export default function ReceptionistBookAppointment() {
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [queueNo, setQueueNo] = useState(null);
  const [currentQueueNo, setCurrentQueueNo] = useState(null);
  const [bookedQueueNo, setBookedQueueNo] = useState(null);   // queue assigned after submit
  const [bookedSuggestedTime, setBookedSuggestedTime] = useState(null); // suggested time after submit
  const [form, setForm] = useState({ patientName: '', patientPhone: '', appointmentDate: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [phoneLookup, setPhoneLookup] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('All');
  const [activeDates, setActiveDates] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const doctorsPerPage = 6;

  useEffect(() => {
    setDoctorsLoading(true);
    doctorService.getLean()
      .then(r => setDoctors(r.data))
      .catch(() => {})
      .finally(() => setDoctorsLoading(false));
  }, []);

  // Fetch which dates already have appointments for the chosen doctor
  useEffect(() => {
    if (!selectedDoctor) { setActiveDates([]); return; }
    appointmentService.getActiveDates({ doctorId: selectedDoctor._id, excludeCancelled: 1 })
      .then(r => setActiveDates(r.data || []))
      .catch(() => setActiveDates([]));
  }, [selectedDoctor]);

  useEffect(() => {
    if (selectedDoctor && form.appointmentDate) {
      appointmentService.getQueue({ doctorId: selectedDoctor._id, date: form.appointmentDate })
        .then(r => {
          setQueueNo(r.data.nextQueue);
          setCurrentQueueNo(r.data.currentQueue);
        }).catch(() => { });
    }
    // Reset booked confirmation whenever doctor/date changes
    setBookedQueueNo(null);
    setBookedSuggestedTime(null);
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
    if (!form.appointmentDate) return toast.error('Please select an appointment date');

    // Validate: doctor has no schedule at all (has left the clinic)
    if (!selectedDoctor.availability || selectedDoctor.availability.length === 0) {
      return toast.error(`${selectedDoctor.designation || 'Dr.'} ${selectedDoctor.name} has no schedule set and may no longer be available. Please contact administration.`);
    }

    // Validate: doctor not available on the selected date
    const selectedIsToday = form.appointmentDate === new Date().toISOString().split('T')[0];
    const slotsOnDay = getSlotsForDate(selectedDoctor, form.appointmentDate);
    const futureSlots = getFutureSlotsToday(selectedDoctor, form.appointmentDate);
    const hasAvailableSlot = selectedIsToday ? futureSlots.length > 0 : slotsOnDay.length > 0;

    if (!hasAvailableSlot) {
      const dayName = DAYS[new Date(form.appointmentDate + 'T00:00:00').getDay()];
      return toast.error(`${selectedDoctor.designation || 'Dr.'} ${selectedDoctor.name} is not available on ${dayName}s. Please select a different date.`);
    }

    setLoading(true);
    try {
      // Capture pre-submit values — state will reset after
      const doctorSnap = selectedDoctor;
      const dateSnap = form.appointmentDate;
      const assignedQueue = queueNo;

      await appointmentService.createPublic({
        patientName: form.patientName,
        patientPhone: form.patientPhone,
        doctorId: selectedDoctor._id,
        serviceId: selectedService.service?._id || selectedService._id,
        appointmentDate: form.appointmentDate,
      });

      // Compute suggested time before resetting
      const suggested = computeSuggestedTime(doctorSnap, dateSnap, assignedQueue);
      setBookedQueueNo(assignedQueue);
      setBookedSuggestedTime(suggested);

      toast.success(`Appointment booked! Queue #${assignedQueue}${suggested ? ` · Suggested arrival: ${suggested}` : ''}`);
      setSelectedDoctor(null); setSelectedService(null);
      setForm({ patientName: '', patientPhone: '', appointmentDate: new Date().toISOString().split('T')[0] });
      setPhoneLookup(false); setQueueNo(null); setCurrentQueueNo(null);
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
  const todayIso = new Date().toISOString().split('T')[0];

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

  return (
    <div>
      <PageHeader title="New Appointment" subtitle="Book a walk-in patient appointment" />
      <div className="grid lg:grid-cols-12 gap-6">

        {/* Left: Doctor + Service picker */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <FiUserCheck className="text-primary-600" size={18} />
              <h3 className="font-display font-bold text-gray-900">Select Doctor</h3>
            </div>
            <div className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input type="text" placeholder="Search by name or specialty..." value={search}
                  onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
              </div>
              <select value={selectedSpec} onChange={e => setSelectedSpec(e.target.value)} className="input-field w-auto">
                {specializations.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 max-h-100 overflow-y-auto pr-1">
              {doctorsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex flex-col p-4 rounded-2xl border-2 border-gray-100 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                        <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-5 bg-gray-100 rounded w-20" />
                      <div className="h-5 bg-gray-100 rounded w-16" />
                    </div>
                  </div>
                ))
              ) : (
                <>
              {filteredDoctors.length === 0 && <p className="text-sm text-gray-400 col-span-full text-center py-6">No doctors found</p>}
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
                        <p className="font-semibold">{doc.designation || 'Dr.'} {doc.name}</p>
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
              </>
              )}
            </div>
            {!doctorsLoading && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-3">

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
                    {selectedDoctor.designation || 'Dr.'} {selectedDoctor.name} is available
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

          {selectedDoctor && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-display font-bold text-gray-900">Services</h3>
                <span className="badge-blue">{selectedDoctor.designation || 'Dr.'} {selectedDoctor.name}</span>
              </div>
              {selectedDoctor.services.length === 0
                ? <p className="text-sm text-gray-400 text-center py-4">No services available</p>
                : <div className="grid gap-2">
                  {selectedDoctor.services.map(svc => (
                    <button key={svc._id} type="button" onClick={() => setSelectedService(svc)}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${selectedService?._id === svc._id ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <span className="font-semibold text-gray-800">{svc.service?.name}</span>
                      <span className="font-bold text-primary-600">LKR {svc.price}</span>
                    </button>
                  ))}
                </div>
              }
            </div>
          )}
        </div>

        {/* Right: Patient form */}
        <div className="lg:col-span-5">
          <form onSubmit={handleSubmit} className="card space-y-5 sticky top-4">
            <h3 className="font-display font-bold text-gray-900">Patient Details</h3>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Appointment Date</label>
              <DatePickerWithHighlights
                value={form.appointmentDate}
                onChange={(iso) => setForm({ ...form, appointmentDate: iso })}
                highlightedDates={activeDates}
                min={todayIso}
                accent="primary"
                legend="Has bookings"
                required
              />
              {selectedDoctor && activeDates.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500 align-middle mr-1" />
                  Highlighted dates already have bookings for {selectedDoctor.designation || 'Dr.'} {selectedDoctor.name}
                </p>
              )}
              {queueNo && selectedDoctor && (
                <div className="mt-2 space-y-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 text-sm flex-shrink-0">
                      #{queueNo}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-emerald-700">Queue #{queueNo} will be assigned</p>
                      {computeSuggestedTime(selectedDoctor, form.appointmentDate, queueNo) && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          🕐 Suggested arrival: <strong>{computeSuggestedTime(selectedDoctor, form.appointmentDate, queueNo)}</strong>
                          <span className="text-emerald-500 ml-1">(~15 min/patient)</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {currentQueueNo && (
                    <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-blue-100">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      Currently with doctor: Patient #{currentQueueNo}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="tel" placeholder="07XXXXXXXX" value={form.patientPhone}
                    onChange={e => { setForm({ ...form, patientPhone: e.target.value }); setPhoneLookup(false); }}
                    className="input-field pl-10" required />
                </div>
                <button type="button" onClick={handlePhoneLookup} className="btn-secondary px-3 flex-shrink-0">
                  <FiSearch size={15} />
                </button>
              </div>
              {phoneLookup && <p className="text-xs text-emerald-600 mt-1">? Name auto-filled from records</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Patient Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input type="text" placeholder="Full name" value={form.patientName}
                  onChange={e => setForm({ ...form, patientName: e.target.value })}
                  className="input-field pl-10" required />
              </div>
            </div>

            {selectedDoctor && selectedService && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Doctor</span>
                  <span className="font-semibold">{selectedDoctor.designation || 'Dr.'} {selectedDoctor.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-semibold">{selectedService.service?.name}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-primary-600">LKR {selectedService.price}</span>
                </div>
              </div>
            )}

            {/* Post-booking confirmation banner */}
            {bookedQueueNo && (
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 text-center space-y-1">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Appointment Confirmed ✓</p>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
                    <span className="font-bold text-emerald-700 text-lg">#{bookedQueueNo}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900">Queue Number</p>
                    {bookedSuggestedTime && (
                      <p className="text-sm text-emerald-700 font-semibold">🕐 Come by <strong>{bookedSuggestedTime}</strong></p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">Estimated 15 min per patient</p>
                  </div>
                </div>
              </div>
            )}

            {selectedDoctor && selectedDoctor.availability?.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                ⚠️ {selectedDoctor.designation || 'Dr.'} {selectedDoctor.name} has no schedule set. They may no longer be available. Please contact administration.
              </div>
            )}
            {selectedDoctor && selectedDoctor.availability?.length > 0 && !isAvailableOnDay && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                ⚠️ {selectedDoctor.designation || 'Dr.'} {selectedDoctor.name} is not available on this date. Please choose a different date.
              </div>
            )}
            <button type="submit"
              disabled={loading || !selectedDoctor || !selectedService || !isAvailableOnDay || selectedDoctor?.availability?.length === 0}
              className="btn-success w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <FiCheckCircle size={16} />
              {loading ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
