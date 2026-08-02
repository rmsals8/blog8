# blog8 설정 가이드

## 1. 테이블 만들기

Supabase 대시보드 > **SQL Editor** 에서 아래 그대로 실행하세요.

```sql
create extension if not exists "pgcrypto";

create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text,
  cover_image text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table posts enable row level security;

-- 공개된 글은 누구나 읽기 가능
create policy "public read published"
on posts for select
using ( published = true );

-- 로그인한 사용자(관리자)는 전부 읽기/쓰기 가능
create policy "authenticated full access"
on posts for all
using ( auth.role() = 'authenticated' )
with check ( auth.role() = 'authenticated' );
```

글에 태그를 저장하려면 `posts` 테이블에 컴럼을 하나 추가하세요 (이미 만들어둔 테이블이 있다면 이 한 줄만 실행하면 됩니다):

```sql
alter table posts add column if not exists tags text[] not null default '{}';
```

추가로, 블로그 설정(이름/소개문구/푸터/파비콘)을 저장할 테이블도 함께 만드세요:

```sql
create table settings (
  key text primary key,
  value text
);

alter table settings enable row level security;

-- 누구나 읽을 수 있어야 홈 화면에 블로그 이름/파비콘이 뜹니다
create policy "public read settings"
on settings for select
using ( true );

-- 로그인한 관리자만 수정 가능
create policy "authenticated write settings"
on settings for all
using ( auth.role() = 'authenticated' )
with check ( auth.role() = 'authenticated' );

insert into settings (key, value) values
  ('site_title', 'blog8'),
  ('site_tagline', '생각을 기록하는 공간'),
  ('footer_text', '© blog8'),
  ('favicon_url', '')
on conflict (key) do nothing;
```

## 2. Storage 버킷 만들기

**Storage > Buckets > Create bucket** 화면에서:

| 항목 | 값 |
|---|---|
| Bucket name | `post-images` |
| Public bucket | ON |
| Restrict file size | ON → `5` MB |
| Restrict MIME types | ON → `image/jpeg, image/png, image/webp, image/gif` |

버킷 생성 후 **Policies** 탭에서 SQL Editor로 아래 실행:

```sql
create policy "public read images"
on storage.objects for select
using ( bucket_id = 'post-images' );

create policy "authenticated upload images"
on storage.objects for insert
with check ( bucket_id = 'post-images' and auth.role() = 'authenticated' );

create policy "authenticated delete images"
on storage.objects for delete
using ( bucket_id = 'post-images' and auth.role() = 'authenticated' );
```

## 3. 관리자 계정 만들기

**Authentication > Users > Add user** 에서 이메일/비밀번호로 계정을 하나 만드세요.
(이 사이트에는 회원가입 기능이 없습니다 — 오직 이 계정으로만 admin.html에 로그인 가능)

## 4. 코드에 프로젝트 정보 연결

`js/api.js` 파일을 열어 두 줄만 수정하세요:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
```

두 값 모두 Supabase 대시보드 **Project Settings > API** 에서 확인합니다.
(DB 비밀번호나 psql 연결 URI는 이 파일에 절대 넣지 않습니다 — 필요 없습니다.)

## 5. 배포 (cloudtype.io)

정적 사이트이므로 별도 빌드 없이 이 폴더 전체를 그대로 cloudtype 정적 호스팅에 올리면 됩니다.
로컬에서 확인하려면 VSCode의 "Live Server" 확장이나 `python -m http.server` 로 열어보세요
(module import를 쓰므로 파일을 그냥 더블클릭해서 열면 동작하지 않습니다).

## 파일 구조

```
blog8/
 ├── index.html      글 목록
 ├── post.html        글 상세
 ├── admin.html        글 작성/관리 (로그인 필요, 메뉴에 노출되지 않음)
 ├── login.html        관리자 로그인 (메뉴에 노출되지 않음)
 ├── 404.html          없는 경로 접속 시 홈으로 이동
 ├── sitemap.xml
 ├── css/style.css
 └── js/
      api.js       Supabase 클라이언트, 설정 로드/저장, 이미지 압축, 파비콘 적용
      auth.js      로그인/로그아웃/세션 확인
      posts.js     공개 글 목록·상세 조회, HTML 정제
      editor.js    글 작성·수정·삭제, 이미지 업로드
      seo.js       글 상세 페이지 메타태그
```

## 6. 관리자 페이지에 구현된 기능

| 기능 | 내용 |
|---|---|
| 글 작성 | 제목, 요약, 대표 이미지, 리치 텍스트 본문(굵게·기울임·제목·목록·링크·이미지), 공개 여부 |
| 글 관리 | 전체 글 목록, 공개/비공개 전환, 삭제 |
| 이미지 업로드 | 업로드 전 브라우저에서 자동 리사이즈(최대 1600px)·압축(JPEG 82%) 후 Storage 저장 |
| 블로그 설정 | 블로그 이름, 소개 문구, 푸터 문구, 파비콘 — 저장 즉시 전체 페이지에 반영 |
| 연결 정보 확인 | 현재 연결된 Supabase URL, 이미지 버킷 이름 읽기 전용 표시 |
| 인증 | Supabase Auth 로그인/로그아웃, 로그인 안 된 상태로 admin.html 접근 시 자동으로 login.html로 이동 |

없는 기능(필요하면 말씀해주세요): 댓글, 검색, 여러 관리자 계정.

글 수정과 태그는 추가되었습니다 — 관리자 페이지 목록에서 「수정」 버튼을 누르면 글상단에 내용이 불러와지고, 글 작성 폼에도 태그 입력란이 생겼습니다.

## 7. 관리자 페이지 숨기기

`admin.html`, `login.html`은 `index.html`/`post.html` 어디에도 링크되어 있지 않고,
`<meta name="robots" content="noindex, nofollow">` 로 검색엔진 색인도 막아뒀습니다.
정확한 주소를 직접 입력해야만 접근할 수 있고, 접근해도 로그인 안 된 상태면 `login.html`로 튕겨나갑니다.

더 감추고 싶다면:
1. `admin.html` → 원하는 이름(예: `mgr-a91k.html`)으로 파일명 변경
2. `login.html`도 원하는 이름으로 변경
3. `js/auth.js` 안의 `login.html`, `admin.html` 문자열 두 곳을 바꾼 파일명으로 수정

(정적 호스팅이라 서버 라우팅으로 경로를 숨기는 대신, 파일명 자체를 추측하기 어렵게 바꾸는 방식입니다.)

## 8-1. 구글 검색 노출 관련

다음이 추가되었습니다:
- `robots.txt` — `admin.html`/`login.html`은 막고 나머지는 크롤링 허용, sitemap 위치 안내
- 각 글 상세 페이지에 canonical 태그, JSON-LD(BlogPosting) 구조화 데이터, Open Graph/Twitter 카드 메타태그 자동 삽입

**직접 바꿔야 하는 것:** `robots.txt`와 `index.html`의 `YOUR_DOMAIN` 부분을 실제 도메인으로 교체하세요. 그 다음 구글 서치 콘솔(Search Console)에 `sitemap.xml` 주소를 제출하면 새 글이 검색엔진에 더 빨리 잡혀요.

## 8. 없는 페이지 접속 시 홈으로 이동

`404.html`을 만들어뒀습니다. cloudtype 등 호스팅 설정에서 **"404 / Not Found 페이지"를 `404.html`로 지정**해두면,
등록되지 않은 임의의 주소로 접속했을 때 자동으로 홈(`index.html`)으로 이동합니다.
글 상세 페이지(`post.html`)에서 존재하지 않는 글 주소로 들어온 경우도 동일하게 홈으로 자동 이동합니다.

## 9. 데이터베이스 정보(연결 키)는 어떻게 감추나요

백엔드 서버 없이 브라우저에서 바로 Supabase에 접속하는 구조라서,
`SUPABASE_URL`과 `SUPABASE_ANON_KEY`는 `js/api.js` 파일 안에 그대로 들어가고,
사이트를 열어본 사람이 개발자도구(Network/Sources)로 마음만 먹으면 볼 수 있습니다. 이건 숨길 수 없는 구조적인 특성이에요.

다만 이건 실제로 문제가 되지 않습니다 — **anon key는 원래 공개되도록 설계된 값**입니다.
비밀번호처럼 감춰야 하는 값이 아니라, "이 앱은 이 프로젝트와 통신합니다"라는 신분증 같은 역할만 합니다.
진짜 보안은 이미 만들어둔 **RLS(Row Level Security) 정책**이 담당합니다:
- `posts` 테이블: `published = true`인 글만 익명 사용자가 읽을 수 있고, 쓰기/수정/삭제는 로그인한 사용자(=관리자 본인)만 가능
- `settings` 테이블: 읽기는 누구나, 쓰기는 로그인한 사용자만
- `storage.objects`(이미지): 읽기는 누구나, 업로드/삭제는 로그인한 사용자만

즉 anon key가 노출돼도 공격자가 할 수 있는 건 "이미 공개로 설정한 글을 읽는 것"뿐이고,
글을 쓰거나 지우려면 관리자 이메일/비밀번호로 실제 로그인해야 합니다.
정말로 DB 비밀번호나 API 키 자체를 서버 뒤에 완전히 숨기고 싶다면 Cloudflare Workers 같은 아주 가벼운 서버리스 함수를 프록시로 하나 두는 방법이 있는데, "백엔드 서버 없이"라는 지금 방향과는 맞지 않아서 적용하지 않았습니다. 필요해지면 말씀해주세요.

앞으로 "테이블 추가해줘" / "버킷 추가로 만들어줘" 라고 요청하시면
필요한 SQL과 설정값을 그대로 만들어 드릴게요.
