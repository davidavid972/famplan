/**
 * Google Identity Services (GSI) auth helper - frontend only, no backend.
 * Uses token client for access token + userinfo for email.
 */

const CLIENT_ID = '1029014170346-3lnbbus3mhiusc0d6oi1m208kaj3kcs5.apps.googleusercontent.com';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const TOKEN_KEY = 'famplan_google_access_token';
const EXPIRY_KEY = 'famplan_google_token_expiry';
const EMAIL_KEY = 'famplan_google_email';

function waitForGsi(): Promise<typeof window.google> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve(window.google);
      return;
    }
    const timeout = 15000;
    const start = Date.now();
    const i = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(i);
        resolve(window.google);
      } else if (Date.now() - start > timeout) {
        clearInterval(i);
        reject(new Error('Google Sign-In script failed to load'));
      }
    }, 100);
  });
}

function isTokenValid(): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY);
  if (!expiry) return false;
  const exp = parseInt(expiry, 10);
  if (isNaN(exp)) return false;
  return Date.now() < exp * 1000;
}

export function getStoredAccessToken(): string | null {
  if (!isTokenValid()) {
    clearGoogleSession();
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function clearGoogleSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function isConnected(): boolean {
  return !!getStoredEmail() && isTokenValid();
}

async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch user info');
  const data = await res.json();
  return data.email || '';
}

export function connectGoogle(): Promise<string> {
  return new Promise((resolve, reject) => {
    waitForGsi()
      .then((google) => {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          prompt: 'consent',
          include_granted_scopes: false,
          callback: async (response) => {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            if (!response.access_token) {
              reject(new Error('No access token received'));
              return;
            }
            const expiresAt = Math.floor(Date.now() / 1000) + (response.expires_in || 3600);
            localStorage.setItem(TOKEN_KEY, response.access_token);
            localStorage.setItem(EXPIRY_KEY, String(expiresAt));
            try {
              const email = await fetchUserEmail(response.access_token);
              localStorage.setItem(EMAIL_KEY, email);
              resolve(email);
            } catch (e) {
              clearGoogleSession();
              reject(e);
            }
          },
        });
        client.requestAccessToken();
      })
      .catch(reject);
  });
}
