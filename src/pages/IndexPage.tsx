import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useI18n } from '../i18n/I18nProvider';
import { useFamily } from '../context/FamilyProvider';
import { useAuth } from '../context/AuthProvider';
import { useData } from '../context/DataProvider';
import { useToast } from '../context/ToastProvider';
import { ConfirmModal } from '../components/ConfirmModal';
import { Calendar, CheckCircle2, Bell, Users, CalendarPlus, UserPlus, List, Clock, MapPin, Plus, Trash2 } from 'lucide-react';
import { PersonAvatar } from '../components/PersonAvatar';
import { format, startOfWeek, addDays, isToday, isSameDay } from 'date-fns';
import { he } from 'date-fns/locale';

export const IndexPage: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { familyDisplayName } = useFamily();
  const { isConnected, connect, isConnecting, canEdit } = useAuth();
  const { people, appointments, deleteAppointment, lastSyncSource } = useData();
  const { showToast } = useToast();
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);

  const today = new Date();
  const formattedDate = today.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const todayAppointments = appointments.filter((a) => isSameDay(new Date(a.start), today));
  const doneCount = appointments.filter((a) => a.status === 'DONE').length;
  /** Reminders: FamPlan-only. Count plans with at least one reminder (minutesBeforeStart > 0). Not from Google Calendar. */
  const remindersWithPlans = appointments.filter((a) =>
    (a.reminders ?? []).some((r) => r.minutesBeforeStart > 0)
  );
  const remindersCount = remindersWithPlans.length;

  useEffect(() => {
    if (import.meta.env.DEV) {
      const ids = appointments
        .filter((a) => (a.reminders ?? []).some((r) => r.minutesBeforeStart > 0))
        .map((a) => a.id);
      console.log('[FamPlan] Reminders debug:', {
        reminderCount: remindersCount,
        planIds: ids,
        dataSource: lastSyncSource ?? 'initial',
      });
    }
  }, [remindersCount, appointments, lastSyncSource]);

  const upcomingAppointments = appointments
    .filter((a) => new Date(a.start) >= today)
    .sort((a, b) => a.start - b.start)
    .slice(0, 5);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.start), day));

  const handleConnect = () => {
    if (!isConnected) connect();
    else navigate('/settings');
  };

  const handleDelete = async () => {
    if (appointmentToDelete) {
      await deleteAppointment(appointmentToDelete);
      showToast(t('appointment_deleted'), 'success');
      setAppointmentToDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>
          {t('index_greeting').replace('{name}', familyDisplayName || t('app_name'))} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{formattedDate}</p>
      </motion.div>

      {/* Google Connect */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 theme-surface flex items-center gap-4"
      >
        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{t('auth_connect_google')}</p>
          <p className="text-xs text-muted-foreground">{t('index_google_sync')}</p>
        </div>
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="theme-primary-btn px-4 py-2 bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-60"
        >
          {isConnecting ? t('auth_connecting') : isConnected ? t('settings_title') : t('index_connect')}
        </button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: t('index_stats_family'), value: String(people.length), color: 'text-family-purple', bg: 'bg-family-purple/10', path: '/people' },
          { icon: Bell, label: t('index_stats_reminders'), value: String(remindersCount), color: 'text-accent', bg: 'bg-accent/10', path: '/calendar' },
          { icon: CheckCircle2, label: t('index_stats_done'), value: String(doneCount), color: 'text-family-green', bg: 'bg-family-green/10', path: '/appointments' },
          { icon: Calendar, label: t('index_stats_today'), value: String(todayAppointments.length), color: 'text-primary', bg: 'bg-primary/10', path: '/calendar' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
            onClick={() => navigate(stat.path)}
            className="flex items-center gap-3 p-4 theme-surface cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Family Members */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('people')}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {people.map((person, i) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.06 * i, duration: 0.3 }}
              onClick={() => navigate(`/people/${person.id}`)}
              className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
            >
              <PersonAvatar person={person} size="lg" />
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate max-w-[60px]">
                {person.name}
              </span>
            </motion.div>
          ))}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            onClick={() => navigate('/people')}
            className="flex flex-col items-center gap-1.5 cursor-pointer group shrink-0"
          >
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center group-hover:border-primary transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t('add_person')}</span>
          </motion.div>
        </div>
      </div>

      {/* Week Overview */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('index_our_week')}</h2>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const dayAppointments = getAppointmentsForDay(day);
            const isTodayDate = isToday(day);
            return (
              <motion.div
                key={day.getTime()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                onClick={() => navigate('/calendar')}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-colors ${
                  isTodayDate ? 'bg-primary text-primary-foreground shadow-md' : 'theme-surface hover:shadow-sm'
                }`}
              >
                <span className={`text-[10px] font-medium ${isTodayDate ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  {format(day, 'EEEEEE', { locale: language === 'he' ? he : undefined })}
                </span>
                <span className={`text-lg font-bold ${isTodayDate ? '' : 'text-foreground'}`}>{format(day, 'd')}</span>
                {dayAppointments.length > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: Math.min(dayAppointments.length, 3) }).map((_, j) => (
                      <div key={j} className={`w-1.5 h-1.5 rounded-full ${isTodayDate ? 'bg-primary-foreground/60' : 'bg-primary/50'}`} />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: CalendarPlus, label: t('add_appointment'), color: 'bg-primary/10 text-primary', path: '/calendar' },
          { icon: UserPlus, label: t('add_person'), color: 'bg-family-blue/10 text-family-blue', path: '/people' },
          { icon: List, label: t('appointments'), color: 'bg-family-purple/10 text-family-purple', path: '/appointments' },
          { icon: Bell, label: t('rem_alert'), color: 'bg-accent/10 text-accent', path: '/settings', state: { openNotifications: true } },
        ].map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.4 }}
            onClick={() => navigate(action.path, { state: action.state })}
            className="flex flex-col items-center gap-2 p-4 theme-surface hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-xl ${action.color} flex items-center justify-center`}>
              <action.icon className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">{action.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Upcoming Events */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: 'Rubik, sans-serif' }}>{t('index_upcoming')}</h2>
          <button onClick={() => navigate('/calendar')} className="text-sm text-primary font-medium hover:underline">
            {t('all')}
          </button>
        </div>
        <div className="space-y-2">
          {upcomingAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('no_appointments')}</p>
          ) : (
            upcomingAppointments.map((app, i) => {
              const person = people.find((p) => p.id === app.personId);
              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.4 }}
                  onClick={() => navigate('/calendar')}
                  className="group flex items-center gap-3 p-3 theme-surface border-r-4 hover:shadow-sm transition-shadow cursor-pointer"
                  style={{ borderRightColor: person?.color || 'hsl(var(--primary))' }}
                >
                  {person ? (
                    <PersonAvatar person={person} size="sm" className="shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                      ?
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{app.title} {person ? `- ${person.name}` : ''}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(app.start, 'HH:mm')}
                      </span>
                      {app.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3" />
                          {app.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAppointmentToDelete(app.id); }}
                      className="p-1.5 min-h-[36px] min-w-[36px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors shrink-0"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!appointmentToDelete}
        onClose={() => setAppointmentToDelete(null)}
        onConfirm={handleDelete}
        title={t('delete')}
        message={t('confirm_delete_appointment')}
      />
    </div>
  );
};
