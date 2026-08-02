// js/seo.js — 글 상세 페이지의 메타 태그를 동적으로 채움
export function applySeo({ title, description, image, url, siteTitle = 'blog8', publishedTime, tags }) {
  document.title = `${title} · ${siteTitle}`;
  setMeta('description', description || '');
  setMeta('og:type', 'article', true);
  setMeta('og:title', title, true);
  setMeta('og:description', description || '', true);
  if (image) setMeta('og:image', image, true);
  if (url) setMeta('og:url', url, true);
  setMeta('twitter:card', image ? 'summary_large_image' : 'summary');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description || '');
  if (image) setMeta('twitter:image', image);
  if (url) setCanonical(url);
  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: description || undefined,
    image: image || undefined,
    datePublished: publishedTime || undefined,
    url: url || undefined,
    keywords: tags && tags.length ? tags.join(', ') : undefined
  });
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

function setJsonLd(obj) {
  let script = document.querySelector('script[type="application/ld+json"]');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  // undefined 값은 JSON.stringify가 자동으로 제거함
  script.textContent = JSON.stringify(obj);
}

function setMeta(name, content, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let tag = document.querySelector(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}
