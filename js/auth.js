// js/auth.js — 관리자 로그인 / 세션 관리
import { supabase, toast } from './api.js';

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'login.html';
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// admin.html 최상단에서 호출: 로그인 안 되어 있으면 login.html로 보냄
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// login.html 폼 바인딩
export function bindLoginForm() {
  const form = document.querySelector('#login-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = '확인 중...';
    try {
      await login(email, password);
      window.location.href = 'admin.html';
    } catch (err) {
      toast(err.message || '로그인에 실패했습니다', true);
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });
}
