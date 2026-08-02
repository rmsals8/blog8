// js/api.js — Supabase 클라이언트 초기화
// 반드시 아래 두 값만 채우세요. (DB 비밀번호/URI는 절대 여기 넣지 않습니다)
// Supabase 대시보드 > Project Settings > API 에서 확인
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qibaojqpevgeakfdzrcu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpYmFvanFwZXZnZWFrZmR6cmN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjE4NzcsImV4cCI6MjEwMDgzNzg3N30.WQmsH7xBRLOSjbvV0yFlVIf-X6W3Hf91iytteIE_vwk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_NAME = 'post-images';

// 화면에 참고용으로 보여줄 연결 정보 (실제 연결 값은 이 파일을 직접 수정해야 바뀝니다)
export const CONNECTION_INFO = { url: SUPABASE_URL };

const SETTINGS_DEFAULTS = {
  site_title: 'blog8',
  site_tagline: '생각을 기록하는 공간',
  footer_text: '© blog8',
  favicon_url: ''
};

export async function getSettings() {
  try {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) throw error;
    const map = Object.fromEntries(data.map(r => [r.key, r.value]));
    return { ...SETTINGS_DEFAULTS, ...map };
  } catch {
    // settings 테이블이 없거나 접근 실패 시 기본값으로 대체
    return { ...SETTINGS_DEFAULTS };
  }
}

export async function saveSettings(obj) {
  const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
  const { error } = await supabase.from('settings').upsert(rows);
  if (error) throw error;
}

// 설정에 저장된 파비콘을 현재 페이지에 적용 (없으면 건드리지 않음 = 기본 favicon.ico 유지)
export function applyFavicon(url) {
  if (!url) return;
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = url;
}

// 브라우저에서 이미지 리사이즈 + JPEG 압축 (gif는 애니메이션 보존을 위해 건너뜀)
export async function compressImage(file, maxWidth = 1600, quality = 0.82) {
  if (!file || !file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob || blob.size >= file.size) return file; // 압축이 더 크면 원본 유지
  return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
}

export function toast(message, isError = false) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function slugify(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60) + '-' + Date.now().toString(36);
}
