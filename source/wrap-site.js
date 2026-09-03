// 산본점 원본(source/open-roadmap-sanbon.html) 하나에서 지점별 페이지를 생성해 저장소 루트에 출력
// 사용법: node source/wrap-site.js  (저장소 어디서 실행해도 됨)
// - 지점 이름/열쇠(지점코드) 치환 + 지점별 예외(오버라이드) + 완전한 HTML 포장 + 카톡 미리보기(OG) 명함
const fs = require("fs");
const path = require("path");

const DOMAIN = "https://roadmap.pixcera.kr";
const OUT_DIR = path.join(__dirname, "..");
const BRANCHES = [
  { key: "sanbon",         out: "sanbon.html",         name: "산본점", code: "BR-002" },
  { key: "uijeongbu",      out: "uijeongbu.html",      name: "의정부점", code: "BR-003" },
  { key: "bundang-migeum", out: "bundang-migeum.html", name: "분당미금점", code: "BR-004" }
];

// 지점별 예외 — [찾을 문자열, 바꿀 문자열] 목록. 원본(산본) 기준의 항목 줄을 통째로 교체한다.
const OVERRIDES = {
  uijeongbu: [
    [
      `        { id: "site",    who: "joint",  name: "입지 확정·임대차 계약", note: "본사 입지 기준 체크리스트로 사전 검토 후 계약" },`,
      `        { id: "transfer",who: "joint",  legal: true, name: "권리양도계약 (전 피부과와)", note: "기존 피부과 자리 양도 — 양도 범위(장비·인테리어·직원 승계 여부)를 계약서에 명시" },
        { id: "lease",   who: "joint",  legal: true, name: "임대차 계약 (임대인과)", note: "권리양도와 별개로 건물주(임대인)와 직접 체결" },`
    ]
  ]
};

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

const template = fs.readFileSync(path.join(__dirname, "open-roadmap-sanbon.html"), "utf8");

for (const b of BRANCHES) {
  let body = template;
  for (const [from, to] of OVERRIDES[b.key] || []) {
    if (!body.includes(from)) throw new Error(`${b.key} 예외 적용 실패 — 원본에서 찾을 수 없음: ${from.slice(0, 60)}`);
    body = body.replace(from, to);
  }
  body = body.replace(/산본점/g, b.name).replace(/sanbon/g, b.key).replace(/BR-002/g, b.code);
  body = body.replace(/^<title>.*<\/title>\s*\n/, "");
  const title = `픽세라 ${b.name} 개원 로드맵`;
  const desc = "픽세라 지점 개원 준비 진행판입니다. 공유받은 비밀번호로 열어보세요.";
  const html = head(title, desc, `${DOMAIN}/${b.out}`) + body + "\n</body>\n</html>\n";
  fs.writeFileSync(path.join(OUT_DIR, b.out), html);
  console.log("생성:", b.out, OVERRIDES[b.key] ? "(지점 예외 적용)" : "");
}

// 대문 페이지 — 지점 목록
const links = BRANCHES.map(
  b => `      <a class="card" href="/${b.out}"><span class="dot"></span>${b.name} 개원 로드맵</a>`
).join("\n");
const index = head("픽세라 개원 로드맵", "픽세라 지점별 개원 준비 진행판", DOMAIN + "/") + `
<style>
  :root { --bg:#F7F5FB; --surface:#FFFFFF; --ink:#302E35; --muted:#6E687F; --line:#E3DDF2; --accent:#6551D9; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#211F28; --surface:#2A2833; --ink:#EAE7F1; --muted:#A29CB4; --line:#3E3A4C; --accent:#9F8FF2; }
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:"Pretendard Variable",Pretendard,"Apple SD Gothic Neo","Malgun Gothic","맑은 고딕",sans-serif; }
  .wrap { max-width:520px; margin:0 auto; padding:60px 20px; text-align:center; }
  h1 { font-size:22px; margin:18px 0 6px; }
  p { color:var(--muted); font-size:14px; margin:0 0 28px; }
  .card { display:flex; align-items:center; gap:10px; justify-content:center;
    background:var(--surface); border:1px solid var(--line); border-radius:12px;
    padding:16px; margin-top:12px; text-decoration:none; color:var(--ink);
    font-weight:700; font-size:15px; }
  .card:hover { border-color:var(--accent); }
  .dot { width:10px; height:10px; border-radius:2px; background:var(--accent); }
  img.logo { width:84px; height:84px; image-rendering:pixelated; }
</style>
<div class="wrap">
  <img class="logo" src="/favicon.png" alt="픽세라 로고">
  <h1>픽세라 개원 로드맵</h1>
  <p>지점을 선택하세요. 공유받은 비밀번호가 필요합니다.</p>
${links}
</div>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT_DIR, "index.html"), index);
console.log("생성: index.html");
