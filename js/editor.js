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

export async function createPost({ title, excerpt, content, coverUrl, published, tags, category, publishAt }) {
  const slug = slugify(title);
  const { data, error } = await supabase.from('posts').insert({
    title, slug, excerpt, content,
    cover_image: coverUrl,
    published,
    tags: tags || [],
    category: category || null,
    publish_at: publishAt || null
  }).select('id, slug').single();
  if (error) throw error;
  return data; // { id, slug }
}

export async function updatePost(id, fields) {
  const { error } = await supabase.from('posts').update(fields).eq('id', id);
  if (error) throw error;
}

// Storage 공개 URL에서 버킷 내부 경로만 추출 (다른 버킷/외부 URL이면 null)
function extractStoragePath(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

// 글 본문(HTML)에서 이미지 src / 첨부파일 href로 쓰인 Storage 경로를 모두 추출
function collectStoragePaths(post) {
  const paths = [];
  const coverPath = extractStoragePath(post.cover_image);
  if (coverPath) paths.push(coverPath);
  if (post.content) {
    const doc = new DOMParser().parseFromString(post.content, 'text/html');
    doc.querySelectorAll('img[src]').forEach(img => {
      const p = extractStoragePath(img.getAttribute('src'));
      if (p) paths.push(p);
    });
    doc.querySelectorAll('a[href]').forEach(a => {
      const p = extractStoragePath(a.getAttribute('href'));
      if (p) paths.push(p);
    });
  }
  return [...new Set(paths)];
}

// 특정 카테고리에 속한 글을 모두 삭제(카테고리 삭제 기능에서 사용) — 각 글의 Storage 파일도 deletePost를 통해 함께 정리된다.
export async function deletePostsByCategory(category) {
  const { data, error } = await supabase.from('posts').select('id').eq('category', category);
  if (error) throw error;
  for (const row of data) {
    await deletePost(row.id);
  }
  return data.length;
}

export async function deletePost(id) {
  // 삭제 전에 본문을 읽어 딸린 Storage 파일 경로(대표이미지·본문이미지·첨부파일)를 먼저 파악
  let paths = [];
  try {
    const post = await fetchPostById(id);
    paths = collectStoragePaths(post);
  } catch {
    // 글을 못 읽어와도 DB 삭제 자체는 계속 진행
  }

  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;

  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(paths);
    if (storageError) {
      // DB 삭제는 이미 끝났으므로 Storage 정리 실패는 콘솔에만 남기고 사용자 흐름은 막지 않음
      console.error('Storage 파일 삭제 실패:', storageError.message);
    }
  }
}

export async function fetchPostById(id) {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchAllPostsForAdmin() {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, slug, published, tags, category, publish_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// published=true인데 publish_at이 미래면 아직 노출 전인 "예약" 상태
function isScheduled(p) {
  return !!(p.published && p.publish_at && new Date(p.publish_at) > new Date());
}

export function renderAdminList(posts, container, { onChange, onEdit }) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state">작성된 글이 없습니다. 위에서 새 글을 작성하세요.</div>`;
    return;
  }
  container.innerHTML = posts.map(p => {
    const scheduled = isScheduled(p);
    const statusText = !p.published ? '임시저장' : (scheduled ? `예약 · ${formatDate(p.publish_at)}` : '공개');
    const statusCls = !p.published ? '' : (scheduled ? 'scheduled' : 'published');
    return `
    <div class="admin-row" data-id="${p.id}">
      <div>
        <span class="status ${statusCls}">${statusText}</span>
        <span class="title">${p.title}</span>
        <div class="mono" style="margin-top:4px;color:var(--ink-soft)">
          ${formatDate(p.created_at)}${p.category ? ' · ' + p.category : ''}${p.tags && p.tags.length ? ' · ' + p.tags.join(', ') : ''}
        </div>
      </div>
      <div class="actions">
        <button class="btn secondary" data-action="edit">수정</button>
        <button class="btn secondary" data-action="toggle">${p.published ? '임시저장으로' : '공개로'}</button>
        <button class="btn danger" data-action="delete">삭제</button>
      </div>
    </div>
  `;
  }).join('');

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
