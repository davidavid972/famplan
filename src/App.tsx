import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nProvider';
import { UserRoleProvider } from './context/UserRoleProvider';
import { AuthProvider } from './context/AuthProvider';
import { FamilyProvider } from './context/FamilyProvider';
import { DataProvider } from './context/DataProvider';
import { ActivityProvider } from './context/ActivityContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { CalendarErrorListener } from './components/CalendarErrorListener';
import { DriveSyncEffect } from './components/DriveSyncEffect';
import { DriveDataSyncEffect } from './components/DriveDataSyncEffect';
import { DriveErrorListener } from './components/DriveErrorListener';
import { RemoteChangesListener } from './components/RemoteChangesListener';
import { IndexPage } from './pages/IndexPage';
import { CalendarPage } from './pages/CalendarPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PeoplePage } from './pages/PeoplePage';
import { PersonDashboardPage } from './pages/PersonDashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function AppContent() {
  return (
    <ToastProvider>
      <CalendarErrorListener />
      <DriveErrorListener />
      <RemoteChangesListener />
      <FamilyProvider>
        <DataProvider>
        <ActivityProvider>
        <ThemeProvider>
        <BrowserRouter>
          <RemoteChangesListener />
          <DriveSyncEffect />
          <DriveDataSyncEffect />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<IndexPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="appointments" element={<AppointmentsPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="people/:id" element={<PersonDashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </ThemeProvider>
        </ActivityProvider>
      </DataProvider>
      </FamilyProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider>
        <UserRoleProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </UserRoleProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
