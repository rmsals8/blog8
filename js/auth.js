// js/auth.js — 관리자 로그인 / 세션 관리
import { supabase, toast } from './api.js';

// 관리자 세션 자동 로그아웃 타이머 — Supabase 인증 토큰과는 별개로,
// "화면상 세션"을 30분으로 관리한다. 뒤로가기/새로고침을 해도 이 시각을
// localStorage에 저장해두므로 만료 전까지는 재로그인 없이 유지된다.
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30분
const EXPIRY_KEY = 'blog8_session_expiry';

function setSessionExpiry() {
  localStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
}

export function getSessionExpiry() {
  const v = localStorage.getItem(EXPIRY_KEY);
  return v ? Number(v) : null;
}

export function clearSessionExpiry() {
  localStorage.removeItem(EXPIRY_KEY);
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  setSessionExpiry();
  return data;
}

export async function logout() {
  clearSessionExpiry();
  await supabase.auth.signOut();
  window.location.href = 'gate-8h4mzp1w6s.html';
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// mgr-k3n9fzq7x2.html 최상단에서 호출: 로그인 안 되어 있거나 30분 세션이
// 만료되었으면 gate-8h4mzp1w6s.html로 보냄
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    clearSessionExpiry();
    window.location.href = 'gate-8h4mzp1w6s.html';
    return null;
  }
  let expiry = getSessionExpiry();
  if (!expiry) {
    // 만료 시각이 없는 상태로 유효한 인증 세션만 있는 경우(예: 이전 버전 세션) — 지금부터 30분 시작
    setSessionExpiry();
    expiry = getSessionExpiry();
  }
  if (Date.now() > expiry) {
    await logout();
    return null;
  }
  return session;
}

// 관리자 페이지의 "세션 연장" 버튼에서 호출 — 인증 토큰도 함께 갱신하고
// 화면상 만료 시각을 다시 30분 뒤로 설정한다.
export async function extendSession() {
  const { error } = await supabase.auth.refreshSession();
  if (error) throw error;
  setSessionExpiry();
  return getSessionExpiry();
}

// 1초마다 남은 시간을 onTick(ms)으로 알려주고, 만료되면 onExpire()를 호출한다.
// 반환된 interval id는 필요 시 clearInterval로 정지할 수 있다.
export function watchSession(onTick, onExpire) {
  const timer = setInterval(() => {
    const expiry = getSessionExpiry();
    if (!expiry) return;
    const remaining = expiry - Date.now();
    if (remaining <= 0) {
      clearInterval(timer);
      onExpire();
    } else {
      onTick(remaining);
    }
  }, 1000);
  return timer;
}

// gate-8h4mzp1w6s.html 폼 바인딩
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
      window.location.href = 'mgr-k3n9fzq7x2.html';
    } catch (err) {
      toast(err.message || '로그인에 실패했습니다', true);
      btn.disabled = false;
      btn.textContent = '로그인';
    }
  });
}
