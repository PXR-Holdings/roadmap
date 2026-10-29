// 진행판 한 페이지 생성기 (대표 「진행해」 2026-10-23 — 한 페이지화)
// 사용법: node source/wrap-site.js  (저장소 어디서 실행해도 됨)
// - 템플릿(source/open-roadmap-sanbon.html) 하나 → 루트 index.html 한 장.
//   지점 이름·코드는 더 이상 생성 때 박지 않는다 — 화면이 주소 쿼리(?branch=지점코드&name=이름)에서 읽는다.
//   본사 장부에 지점을 더하고 주소만 만들면 페이지가 바로 선다(생성·게시 손 0 — 대표 뜻).
// - 지점별 항목 예외는 코드가 아니라 자료 표(source/항목예외.json → 루트 항목예외.json)로 — 화면이 fetch 로 읽는다.
// - 옛 지점별 페이지 여섯 주소는 넘기기 문서로 유지(이전 공유 링크 안 끊기게).
// - pages.json 은 폐지됨(10/24 — 포털 판이 /?branch=&name= 꼴로 직접 링크, 더는 안 읽음).
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

// 뿌리 지점 고르기 목록 (대표 지시 10/29) — 지점 장부(본사 저장소)에서 읽는다. 손으로 안 박는다 — 지점 늘면 재생성으로 저절로.
//   열린 지점(개원준비) = 단추 · 개원 끝(운영중) = 「개원 완료 · 보관본」 줄 · 시험 지점 제외.
const 장부파일 = "C:/dev/pixcera/apps/branches/data/지점장부.json";
const 장부 = JSON.parse(fs.readFileSync(장부파일, "utf8"));   // 못 읽으면 여기서 멈춘다 — 목록 없이 게시하지 않는다
const 옛주소 = Object.fromEntries(OLD_PAGES.map(b => [b.code, "/" + b.out]));
const 지점들 = (장부.지점 || []).filter(b => b && /^BR-\d{3}$/.test(String(b.지점코드)) && b.상태 !== "시험");
const 링크 = b => 옛주소[b.지점코드] || `/?branch=${b.지점코드}&name=${encodeURIComponent(b.지점명)}`;
const 열린칸 = 지점들.filter(b => b.상태 !== "운영중")
  .map(b => `      <a class="card" href="${링크(b)}"><span class="dot"></span>${b.지점명} 개원 로드맵</a>`).join("\n");
const 끝난칸 = 지점들.filter(b => b.상태 === "운영중")
  .map(b => `      <a class="card closedcard" href="${링크(b)}"><span class="dot"></span>${b.지점명} <span class="chip retiredchip">개원 완료 · 보관본</span></a>`).join("\n");
const 고르기HTML = 열린칸 + (끝난칸 ? `\n      <h2 class="done-head">개원을 마친 지점 — 보기만 됩니다</h2>\n` + 끝난칸 : "");
console.log(`지점 고르기: 열린 ${지점들.filter(b => b.상태 !== "운영중").length} · 개원 끝 ${지점들.filter(b => b.상태 === "운영중").length} (장부에서 읽음)`);

// 한 페이지(index.html) — 템플릿 + 고르기 목록 끼움
let body = fs.readFileSync(path.join(__dirname, "open-roadmap-sanbon.html"), "utf8");
if (!body.includes("<!--지점고르기-->")) throw new Error("템플릿에 지점고르기 자리가 없다");
body = body.replace("<!--지점고르기-->", () => 고르기HTML);
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
