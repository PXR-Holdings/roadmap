// 진행판 한 페이지 생성기 (대표 「진행해」 2026-10-23 — 한 페이지화)
// 사용법: node source/wrap-site.js  (저장소 어디서 실행해도 됨)
// - 템플릿(source/open-roadmap-sanbon.html) 하나 → 루트 index.html 한 장.
//   지점 이름·코드는 더 이상 생성 때 박지 않는다 — 화면이 주소 쿼리(?branch=지점코드&name=이름)에서 읽는다.
//   본사 장부에 지점을 더하고 주소만 만들면 페이지가 바로 선다(생성·게시 손 0 — 대표 뜻).
// - 지점별 항목 예외는 코드가 아니라 자료 표(source/항목예외.json → 루트 항목예외.json)로 — 화면이 fetch 로 읽는다.
// - 옛 지점별 페이지 여섯 주소는 넘기기 문서로 유지(이전 공유 링크 안 끊기게).
// - pages.json 은 폐지 예정 — 포털 새 판(링크 규칙 고침)이 게시될 때까지만 새 주소 꼴로 계속 낸다.
const fs = require("fs");
const path = require("path");

const DOMAIN = "https://roadmap.pixcera.kr";
const OUT_DIR = path.join(__dirname, "..");
// 넘기기 전용 — 옛 지점별 페이지 주소(2026-10-23 한 페이지화 전 공유 링크). 새 지점은 더 이상 여기 안 더한다.
const OLD_PAGES = [
  { out: "sanbon.html",         name: "산본점", code: "BR-003" },
  { out: "uijeongbu.html",      name: "의정부점", code: "BR-007" },
  { out: "bundang-migeum.html", name: "분당미금점", code: "BR-004" },
  { out: "gimpo.html",          name: "김포점", code: "BR-005" },
  { out: "gangnam.html",        name: "강남점", code: "BR-006" },
  { out: "balsan.html",         name: "발산점", code: "BR-008" }
];

function head(title, desc, url) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${DOMAIN}/pixcera-og.png">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="400">
<meta property="og:url" content="${url}">
<link rel="icon" type="image/png" href="/favicon.png">
</head>
<body>
`;
}

// 한 페이지(index.html) — 템플릿 그대로, 생성 치환 없음
let body = fs.readFileSync(path.join(__dirname, "open-roadmap-sanbon.html"), "utf8");
body = body.replace(/^<title>.*<\/title>\s*\n/, "");
const title = "픽세라 개원 로드맵";
const desc = "픽세라 지점 개원 준비 진행판입니다. 공유받은 비밀번호로 열어보세요.";
fs.writeFileSync(path.join(OUT_DIR, "index.html"), head(title, desc, DOMAIN + "/") + body + "\n</body>\n</html>\n");
console.log("생성: index.html (한 페이지 — 지점은 주소 쿼리)");

// 지점별 항목 예외 자료 표 — 원본은 source/항목예외.json, 루트로 복사(화면이 fetch)
const over = fs.readFileSync(path.join(__dirname, "항목예외.json"), "utf8");
JSON.parse(over);   // 깨진 채 게시되지 않게
fs.writeFileSync(path.join(OUT_DIR, "항목예외.json"), over);
console.log("생성: 항목예외.json");

// 옛 지점별 페이지 → 새 주소 넘기기 (이전 공유 링크 보존)
for (const b of OLD_PAGES) {
  const 새주소 = `/?branch=${b.code}&name=${encodeURIComponent(b.name)}`;
  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${새주소}">
<title>픽세라 ${b.name} 개원 로드맵</title>
<meta property="og:title" content="픽세라 ${b.name} 개원 로드맵">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${DOMAIN}/pixcera-og.png">
<link rel="icon" type="image/png" href="/favicon.png">
<script>location.replace(${JSON.stringify(새주소)});</script>
</head>
<body><p><a href="${새주소}">진행판으로 이동</a></p></body>
</html>
`;
  fs.writeFileSync(path.join(OUT_DIR, b.out), html);
  console.log("넘기기:", b.out, "→", 새주소);
}

// pages.json — 폐지 예정(포털 새 판 게시 뒤 제거). 그때까지 새 주소 꼴로 유지.
const pages = {
  형식버전: "roadmap-pages/0.1",
  갱신: new Date().toISOString().slice(0, 10),
  대문: DOMAIN + "/",
  지점: Object.fromEntries(OLD_PAGES.map(b => [b.code, DOMAIN + `/?branch=${b.code}&name=${encodeURIComponent(b.name)}`])),
};
fs.writeFileSync(path.join(OUT_DIR, "pages.json"), JSON.stringify(pages, null, 2) + "\n");
console.log("생성: pages.json (폐지 예정 — 포털 새 판 뒤 제거, " + Object.keys(pages.지점).length + "지점)");
