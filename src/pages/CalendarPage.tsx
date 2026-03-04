import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin, AlignLeft } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, isToday, parseISO } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { Appointment, AppointmentStatus } from '../types/models';

export const CalendarPage: React.FC = () => {
  const { t, language, dir } = useI18n();
  const { appointments, people, addAppointment } = useData();
  const { showToast } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const dateLocale = language === 'he' ? he : enUS;

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const dateFormat = "MMMM yyyy";
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredAppointments = appointments.filter(
    (app) => !selectedPersonId || app.personId === selectedPersonId
  );

  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter((app) => isSameDay(new Date(app.start), day));
  };

  const [newAppt, setNewAppt] = useState({
    title: '',
    personId: '',
    start: '',
    end: '',
    location: '',
    notes: '',
  });

  const handleOpenModal = (date: Date) => {
    setSelectedDate(date);
    setNewAppt({
      title: '',
      personId: selectedPersonId || (people.length > 0 ? people[0].id : ''),
      start: format(date, "yyyy-MM-dd'T'09:00"),
      end: format(date, "yyyy-MM-dd'T'10:00"),
      location: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSaveAppointment = () => {
    if (!newAppt.title || !newAppt.personId || !newAppt.start || !newAppt.end) {
      showToast(t('required_field'), 'error');
      return;
    }

    const startMs = new Date(newAppt.start).getTime();
    const endMs = new Date(newAppt.end).getTime();

    if (endMs <= startMs) {
      showToast(t('end_time_error'), 'error');
      return;
    }

    addAppointment({
      title: newAppt.title,
      personId: newAppt.personId,
      start: startMs,
      end: endMs,
      location: newAppt.location,
      notes: newAppt.notes,
      status: 'PLANNED',
    });

    showToast(t('appointment_added'), 'success');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">{t('calendar')}</h1>
          <div className="flex items-center bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <button
              onClick={dir === 'rtl' ? nextMonth : prevMonth}
              className="p-2 hover:bg-stone-50 transition-colors border-r border-stone-200"
            >
              <ChevronLeft className="w-5 h-5 text-stone-600" />
            </button>
            <span className="px-4 py-2 font-medium text-stone-900 min-w-[140px] text-center">
              {format(currentDate, dateFormat, { locale: dateLocale })}
            </span>
            <button
              onClick={dir === 'rtl' ? prevMonth : nextMonth}
              className="p-2 hover:bg-stone-50 transition-colors border-l border-stone-200"
            >
              <ChevronRight className="w-5 h-5 text-stone-600" />
            </button>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal(new Date())}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          <span>{t('add_appointment')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setSelectedPersonId(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedPersonId === null
              ? 'bg-stone-900 text-white'
              : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
          }`}
        >
          {t('all')}
        </button>
        {people.map((person) => (
          <button
            key={person.id}
            onClick={() => setSelectedPersonId(person.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              selectedPersonId === person.id
                ? 'text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
            style={{
              backgroundColor: selectedPersonId === person.id ? person.color : 'white',
              borderColor: selectedPersonId === person.id ? person.color : undefined,
            }}
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: selectedPersonId === person.id ? 'white' : person.color }}
            />
            {person.name}
          </button>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
            const date = new Date();
            date.setDate(date.getDate() - date.getDay() + i);
            return (
              <div key={day} className="py-3 text-center text-sm font-medium text-stone-500">
                {format(date, 'EEEEEE', { locale: dateLocale })}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day, dayIdx) => {
            const dayAppointments = getAppointmentsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toString()}
                onClick={() => handleOpenModal(day)}
                className={`min-h-[100px] p-2 border-b border-r border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors relative ${
                  !isCurrentMonth ? 'bg-stone-50/50 text-stone-400' : 'text-stone-900'
                } ${dayIdx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${
                      isTodayDate ? 'bg-emerald-600 text-white' : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1 overflow-y-auto max-h-[80px] scrollbar-hide">
                  {dayAppointments.map((app) => {
                    const person = people.find((p) => p.id === app.personId);
                    if (!person) return null;
                    return (
                      <div
                        key={app.id}
                        className="px-1.5 py-0.5 text-xs rounded-md truncate text-white font-medium"
                        style={{ backgroundColor: person.color }}
                        title={app.title}
                      >
                        {format(app.start, 'HH:mm')} {app.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-stone-900">{t('add_appointment')}</h2>
            </div>
            
            {people.length === 0 ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                  <CalendarIcon className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-stone-600">{t('no_people')}</p>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors"
                >
                  {t('cancel')}
                </button>
              </div>
            ) : (
              <>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('title')} *
                    </label>
                    <input
                      type="text"
                      value={newAppt.title}
                      onChange={(e) => setNewAppt({ ...newAppt, title: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      placeholder={t('title')}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('person')} *
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {people.map((person) => (
                        <button
                          key={person.id}
                          onClick={() => setNewAppt({ ...newAppt, personId: person.id })}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 border ${
                            newAppt.personId === person.id
                              ? 'border-transparent text-white shadow-sm'
                              : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                          }`}
                          style={{
                            backgroundColor: newAppt.personId === person.id ? person.color : undefined,
                          }}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: newAppt.personId === person.id ? 'white' : person.color }}
                          />
                          {person.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        {t('start_time')} *
                      </label>
                      <input
                        type="datetime-local"
                        value={newAppt.start}
                        onChange={(e) => setNewAppt({ ...newAppt, start: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">
                        {t('end_time')} *
                      </label>
                      <input
                        type="datetime-local"
                        value={newAppt.end}
                        onChange={(e) => setNewAppt({ ...newAppt, end: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('location')}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-stone-400" />
                      </div>
                      <input
                        type="text"
                        value={newAppt.location}
                        onChange={(e) => setNewAppt({ ...newAppt, location: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white"
                        placeholder={t('location')}
                        dir={dir}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t('notes')}
                    </label>
                    <div className="relative">
                      <div className="absolute top-3 left-3 pointer-events-none">
                        <AlignLeft className="h-5 w-5 text-stone-400" />
                      </div>
                      <textarea
                        value={newAppt.notes}
                        onChange={(e) => setNewAppt({ ...newAppt, notes: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-stone-50 focus:bg-white min-h-[100px] resize-y"
                        placeholder={t('notes')}
                        dir={dir}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 p-6 bg-stone-50 border-t border-stone-100 sticky bottom-0 z-10">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleSaveAppointment}
                    className="px-6 py-3 font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    {t('save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
