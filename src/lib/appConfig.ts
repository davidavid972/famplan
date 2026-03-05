/**
 * App config - env vars for preview/production switching.
 * Set VITE_APP_URL in Vercel env or .env for invite/share links.
 */
export const APP_URL =
  import.meta.env.VITE_APP_URL ||
  'https://famplan-git-ui-v1-davidavid972-5513s-projects.vercel.app';
