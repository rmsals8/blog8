// js/posts.js — 공개 글 목록 / 상세 조회
import { supabase, formatDate } from './api.js';

export async function fetchPublishedPosts(tag = null) {
  let query = supabase
    .from('posts')
    .select('id, title, slug, excerpt, cover_image, tags, created_at')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (tag) query = query.contains('tags', [tag]);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchPostBySlug(slug) {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();
  if (error) throw error;
  return data;
}

export function renderPostList(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state">아직 작성된 글이 없습니다.</div>`;
    return;
  }
  container.innerHTML = posts.map(p => `
    <article class="post-card">
      <div class="date-tab mono">${formatDate(p.created_at)}</div>
      <div>
        <h2><a href="post.html?slug=${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}</a></h2>
        ${p.excerpt ? `<p>${escapeHtml(p.excerpt)}</p>` : ''}
        ${renderTagChips(p.tags)}
        ${p.cover_image ? `<img class="cover" src="${p.cover_image}" alt="" loading="lazy">` : ''}
      </div>
    </article>
  `).join('');
}

export function renderTagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="tag-chips">${tags.map(t =>
    `<a class="tag-chip" href="index.html?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`
  ).join('')}</div>`;
}

// 관리자 에디터가 만든 HTML을 허용된 태그/속성만 남기고 정제해서 렌더링
const ALLOWED_TAGS = new Set(['P','B','STRONG','I','EM','H2','H3','A','IMG','BR','UL','OL','LI','DIV','SPAN']);
const ALLOWED_ATTR = { A: ['href'], IMG: ['src', 'alt'] };

export function sanitizeHtml(html = '') {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (node) => {
    [...node.children].forEach(el => {
      if (!ALLOWED_TAGS.has(el.tagName)) {
        el.replaceWith(...el.childNodes);
        return;
      }
      const allowedAttrs = ALLOWED_ATTR[el.tagName] || [];
      [...el.attributes].forEach(attr => {
        if (!allowedAttrs.includes(attr.name) || attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
      clean(el);
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
}

export function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
