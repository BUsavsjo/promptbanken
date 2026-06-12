import { hasSupabaseConfig, supabase } from './supabaseClient.js';

export function requireSupabaseConfig(statusElement) {
  if (hasSupabaseConfig) {
    return true;
  }

  if (statusElement) {
    statusElement.textContent = 'Supabase saknar lokal konfiguration. Kontrollera .env.local.';
    statusElement.classList.add('is-error');
  }

  return false;
}

export async function getCurrentSession() {
  if (!hasSupabaseConfig) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  return data.session;
}

export async function redirectIfAuthenticated(targetUrl = 'admin.html') {
  const session = await getCurrentSession();
  if (session) {
    window.location.replace(targetUrl);
  }
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) {
    const redirectTo = encodeURIComponent(window.location.pathname.split('/').pop() || 'admin.html');
    window.location.replace(`login.html?redirect=${redirectTo}`);
    return null;
  }

  return session;
}

export function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (!redirect || redirect.startsWith('http') || redirect.startsWith('//')) {
    return 'admin.html';
  }

  return redirect;
}
