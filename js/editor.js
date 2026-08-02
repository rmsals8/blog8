// js/editor.js — 관리자: 글 목록 / 작성 / 수정 / 삭제 / 이미지 업로드 / 사이트맵 생성
import { supabase, BUCKET_NAME, toast, formatDate, slugify, compressImage } from './api.js';

export async function uploadImage(file) {
  if (!file) return null;
  const compressed = await compressImage(file); // 업로드 전 자동 리사이즈/압축 (손실 압축 — 원본 화질로 되돌릴 수는 없습니다)
  const ext = compressed.name.split('.').pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, compressed, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

// 이미지가 아닌 일반 파일(PDF 등) 첲부 업로드 — 압축 없이 원본 그대로 저장
// 버킷의 "Restrict MIME types"에 원하는 파일 형식(예: application/pdf)을, "Restrict file size"에 원하는 용량을 대시보드에서 미리 허용해둔야 합니다.
export async function uploadAttachment(file) {
  if (!file) return null;
  const ext = file.name.split('.').pop();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
  return { url: data.publicUrl, name: file.name };
}

export function parseTags(raw = '') {
  return [...new Set(
    raw.split(',').map(t => t.trim()).filter(Boolean)
  )].slice(0, 10);
}

export async function createPost({ title, excerpt, content, coverUrl, published, tags }) {
  const slug = slugify(title);
  const { error } = await supabase.from('posts').insert({
    title, slug, excerpt, content,
    cover_image: coverUrl,
    published,
    tags: tags || []
  });
  if (error) throw error;
  return slug;
}

export async function updatePost(id, fields) {
  const { error } = await supabase.from('posts').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deletePost(id) {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPostById(id) {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchAllPostsForAdmin() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, published, tags, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export function renderAdminList(posts, container, { onChange, onEdit }) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state">작성된 글이 없습니다. 위에서 새 글을 작성하세요.</div>`;
    return;
  }
  container.innerHTML = posts.map(p => `
    <div class="admin-row" data-id="${p.id}">
      <div>
        <span class="status ${p.published ? 'published' : ''}">${p.published ? '공개' : '비공개'}</span>
        <span class="title">${p.title}</span>
        <div class="mono" style="margin-top:4px;color:var(--ink-soft)">
          ${formatDate(p.created_at)}${p.tags && p.tags.length ? ' · ' + p.tags.join(', ') : ''}
        </div>
      </div>
      <div class="actions">
        <button class="btn secondary" data-action="edit">수정</button>
        <button class="btn secondary" data-action="toggle">${p.published ? '비공개로' : '공개로'}</button>
        <button class="btn danger" data-action="delete">삭제</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.admin-row').forEach(row => {
    const id = row.dataset.id;
    row.querySelector('[data-action=edit]').addEventListener('click', () => onEdit(id));
    row.querySelector('[data-action=toggle]').addEventListener('click', async () => {
      const p = posts.find(p => p.id === id);
      try {
        await updatePost(id, { published: !p.published });
        toast('상태를 변경했습니다');
        onChange();
      } catch (err) { toast(err.message, true); }
    });
    row.querySelector('[data-action=delete]').addEventListener('click', async () => {
      if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
      try {
        await deletePost(id);
        toast('삭제했습니다');
        onChange();
      } catch (err) { toast(err.message, true); }
    });
  });
}

// 공개된 글 목록으로 sitemap.xml 내용을 만들어 다운로드 (정적 파일이라 직접 교체해야 함)
export async function generateSitemap(siteUrl) {
  const { data, error } = await supabase
    .from('posts')
    .select('slug, updated_at')
    .eq('published', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const base = siteUrl.replace(/\/$/, '');
  const urls = [
    `  <url><loc>${base}/index.html</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...data.map(p => `  <url><loc>${base}/post.html?slug=${encodeURIComponent(p.slug)}</loc><lastmod>${new Date(p.updated_at).toISOString().slice(0,10)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`)
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;

  const blob = new Blob([xml], { type: 'application/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sitemap.xml';
  a.click();
  URL.revokeObjectURL(a.href);
}
