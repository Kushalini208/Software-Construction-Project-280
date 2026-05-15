// ─── AUTH ────────────────────────────────────────────────────────────
import { supabase } from './supabase.js';
import { showToast } from './app.js';

export let currentUser = null;

// ── Show correct page based on session
export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    enterApp();
  } else {
    showPage('page-auth');
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      enterApp();
    } else {
      currentUser = null;
      showPage('page-auth');
    }
  });
}

function enterApp() {
  showPage('page-app');
  const meta = currentUser.user_metadata;
  const name = meta?.full_name || currentUser.email.split('@')[0];
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('dropdown-name').textContent = name;
  document.getElementById('dropdown-email').textContent = currentUser.email;
}

export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Page switching between sign in and sign up
document.getElementById('btn-to-signup').addEventListener('click', () => {
  document.getElementById('auth-signin').classList.remove('active');
  document.getElementById('auth-signup').classList.add('active');
});

document.getElementById('btn-to-signin').addEventListener('click', () => {
  document.getElementById('auth-signup').classList.remove('active');
  document.getElementById('auth-signin').classList.add('active');
});


// ── Login
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = e.target.querySelector('button[type=submit]');

  errEl.textContent = '';
  errEl.classList.remove('success');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  btn.textContent = 'Sign in →';
  btn.disabled = false;

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('success');
  }
});

// ── Sign up
document.getElementById('form-signup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const errEl    = document.getElementById('signup-error');
  const btn      = e.target.querySelector('button[type=submit]');

  errEl.textContent = '';
  errEl.classList.remove('success');

  if (password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    return;
  }

  btn.textContent = 'Creating account…';
  btn.disabled = true;

  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: name } }
  });

  btn.textContent = 'Create account →';
  btn.disabled = false;

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove('success');
  } else {
    errEl.classList.add('success');
    errEl.textContent = 'Check your email to confirm your account!';
  }
});

// ── User avatar dropdown toggle
const userAvatarBtn = document.getElementById('user-avatar');
const profileDropdown = document.getElementById('profile-dropdown');

userAvatarBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  profileDropdown.classList.remove('open');
});

// ── Logout
document.getElementById('btn-logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  profileDropdown.classList.remove('open');
  showToast('Signed out');
});
