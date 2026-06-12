import { getRedirectTarget, redirectIfAuthenticated, requireSupabaseConfig } from './auth.js';
import { supabase } from './supabaseClient.js';

const form = document.querySelector('[data-login-form]');
const emailInput = document.querySelector('[data-login-email]');
const passwordInput = document.querySelector('[data-login-password]');
const statusElement = document.querySelector('[data-login-status]');

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle('is-error', isError);
}

async function handleLogin(event) {
  event.preventDefault();

  if (!requireSupabaseConfig(statusElement)) {
    return;
  }

  setStatus('Loggar in...');

  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value
  });

  if (error) {
    setStatus(error.message || 'Inloggningen misslyckades.', true);
    return;
  }

  window.location.assign(getRedirectTarget());
}

if (form) {
  form.addEventListener('submit', handleLogin);
}

if (requireSupabaseConfig(statusElement)) {
  redirectIfAuthenticated(getRedirectTarget()).catch((error) => {
    setStatus(error.message || 'Kunde inte kontrollera session.', true);
  });
}
