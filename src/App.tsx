import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nProvider';
import { AuthProvider } from './context/AuthProvider';
import { FamilyProvider } from './context/FamilyProvider';
import { DataProvider } from './context/DataProvider';
import { ToastProvider } from './context/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { DriveSyncEffect } from './components/DriveSyncEffect';
import { CalendarPage } from './pages/CalendarPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonDashboardPage } from './pages/PersonDashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  return (
    <ToastProvider>
      <FamilyProvider>
        <DataProvider>
        <BrowserRouter>
          <DriveSyncEffect />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/settings" replace />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="people/:id" element={<PersonDashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DataProvider>
      </FamilyProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
