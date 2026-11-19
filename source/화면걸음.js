// 진행판 화면 걸음 — 진짜 크로미움(Edge headless)을 원격 조종(CDP)해 한 페이지 판을 밟는다 (밟기 전 신호 금지 · 10/21 방식)
// ─────────────────────────────────────────────────────────────
// 전제: 로컬 미리보기 서버가 떠 있다(기본 http://127.0.0.1:8377 — npx http-server . -p 8377).
//   node source/화면걸음.js [--주소 http://127.0.0.1:8377] [--캡처폴더 <폴더>]
// 걸음: ① /?branch=BR-008&name=발산점 — 문 제목·비밀번호 → 판 열림·45항목·코드 표시 ② /?branch=BR-007&name=의정부점 — 예외 항목(권리양도)·46항목
//       ③ / — 지점 고르기(창구 목록으로 · 못 읽으면 경고 줄) ④ /balsan.html — 새 주소로 넘어감 ⑤ 틀린 코드 → 안내+고르기
//       ⑥~⑧(--가짜창구) 열림 저장·닫힘 보관·그새 닫힘 ⑨~⑪(--가짜창구) ?list 목록 — 고르기 다시 그림·장부 이름 따라감·운영 전환=보관 자동
// 격리(로컬)에서는 공용 장부 창구가 CORS 로 막혀 「연결 안 됨」이 정상 — 그 오류만 거르고 나머지 콘솔 오류는 0 이어야 통과.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const { spawn } = require("child_process");
const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i >= 0 && 인자[i + 1] ? 인자[i + 1] : 기본; };
const 주소 = 값("--주소", "http://127.0.0.1:8377");
// --가짜창구: 공용 장부 창구 호출을 CDP 로 가로채 가짜 답을 준다(격리 — 보관 열림/닫힘 걸음용 · 운영 걸음에선 쓰지 않는다)
const 가짜창구켬 = 인자.includes("--가짜창구");
const 가짜 = { state: { checks: {}, equip: [], opendate: "" }, 닫힘저장: false, 목록: null };   // 목록 = ?list 답(장부따라가기 v0) — null 이면 목록 없음 꼴
const 캡처폴더 = 값("--캡처폴더", fs.mkdtempSync(path.join(os.tmpdir(), "진행판화면-")));
fs.mkdirSync(캡처폴더, { recursive: true });
const 디버그포트 = 19233;
const 브라우저들 = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"];
const 브라우저 = 브라우저들.find(p => fs.existsSync(p)); if (!브라우저) { console.error("크로미움을 못 찾음"); process.exit(2); }
const ok = [], bad = [], 콘솔오류 = [];
const 검 = (조건, 글, 덧) => (조건 ? ok : bad).push(글 + (덧 !== undefined ? " · " + String(덧).slice(0, 200) : ""));
const 자기 = ms => new Promise(r => setTimeout(r, ms));

// ── CDP 아주 작은 손 (AI 카드 화면걸음과 같은 꼴) ──
let ws, 번호 = 0; const 기다림 = new Map(); const 사건들 = [];
function 보내기(method, params = {}, sessionId) { return new Promise((res, rej) => { const id = ++번호; 기다림.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
async function 붙기() {
  const 목록 = await new Promise((res, rej) => http.get(`http://127.0.0.1:${디버그포트}/json/version`, r => { let s = ""; r.on("data", d => s += d); r.on("end", () => { try { res(JSON.parse(s)); } catch (e) { rej(e); } }); }).on("error", rej));
  ws = new WebSocket(목록.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && 기다림.has(m.id)) { const w = 기다림.get(m.id); 기다림.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
    else if (m.method === "Fetch.requestPaused" && 가짜창구켬) 가짜답(m.params, m.sessionId).catch(() => {});
    else if (m.method) 사건들.push(m);
  };
  const { targetId } = await 보내기("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await 보내기("Target.attachToTarget", { targetId, flatten: true });
  await 보내기("Page.enable", {}, sessionId); await 보내기("Runtime.enable", {}, sessionId); await 보내기("Log.enable", {}, sessionId);
  if (가짜창구켬) await 보내기("Fetch.enable", { patterns: [{ urlPattern: "*ps8sq0dj15*" }] }, sessionId);
  await 보내기("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  return sessionId;
}
// 격리에서 정상인 오류만 거른다: 공용 장부 창구 CORS/연결(로컬 출처는 창구가 안 받음) · favicon · og 그림
const 거를오류 = /ps8sq0dj15|CORS|ERR_FAILED|favicon|pixcera-og/;
function 콘솔모으기() {
  for (const m of 사건들.splice(0)) {
    if (m.method === "Runtime.exceptionThrown") 콘솔오류.push("예외: " + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text || "").slice(0, 200));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") { const t = m.params.args.map(a => a.value || a.description || "").join(" "); if (!거를오류.test(t)) 콘솔오류.push("console.error: " + t.slice(0, 200)); }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !거를오류.test(m.params.entry.text || "")) 콘솔오류.push("log: " + (m.params.entry.text || "").slice(0, 200));
  }
}
// 가짜 창구 답 — 창구 규약(닫기·보관 10/23)과 같은 꼴: GET {ok,state} · 닫힌 지점 저장 {ok:false,error:"closed",closedAt}
async function 가짜답(p, sid) {
  const 몸머리 = [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }];
  let 답;
  if (p.request.method === "POST" && /\/sched(\?|#|$)/.test(p.request.url)) {
    // 전체 일정 문 둘(접점 v0.1 · 서버 방 11/19: 같은 창구 주소 뒤 /sched) — 본문 꼴은 접점 그대로
    let j = {};
    try { j = JSON.parse(p.request.postData || "{}"); } catch {}
    if (j.editKey !== "편집키1122") 답 = { ok: false, error: "bad_edit_key" };
    else if (j.schedList) 답 = { ok: true, branches: JSON.parse(JSON.stringify(가짜.일정 || [])), savedAt: new Date().toISOString() };
    else if (j.branch && j.sched) {
      const 칸들 = ["lease", "intStart", "intEnd", "intDone", "equipIn", "eduStart", "eduEnd"];
      const 줄 = (가짜.일정 || []).find(b => b.code === j.branch);
      if (!줄) 답 = { ok: false, error: "bad_branch" };
      else if (Object.keys(j.sched).some(k => !칸들.includes(k)) ||
               칸들.some(k => k !== "intDone" && j.sched[k] && !/^\d{4}-\d{2}-\d{2}$/.test(j.sched[k])) ||
               ("intDone" in j.sched && typeof j.sched.intDone !== "boolean")) 답 = { ok: false, error: "bad_sched" };
      else if (가짜.일정충돌 > 0) { 가짜.일정충돌--; 답 = { ok: false, error: "conflict" }; }   // 동시 저장 겹침 — 저장 0(서버 규약 11/19 조건부 쓰기 상한)
      else { 줄.sched = j.sched; 답 = { ok: true, savedAt: new Date().toISOString() }; if (가짜.일정경고) 답.warn = "log_failed"; }   // 보낸 칸만 남음(통째 교체 — 서버 꼴) · warn = 이력만 못 남음(저장은 됨)
    }
    else 답 = { ok: false, error: "bad_request" };
  }
  else if (p.request.method === "POST") {
    let j = {};
    try { j = JSON.parse(p.request.postData || "{}"); } catch {}
    if (j && (j.editKey !== undefined || (j.config && !j.branch))) {
      // 목록 편집 저장(접점 v0) — 창구가 본사용 편집 비밀번호 지문으로 판정하는 꼴을 흉내
      if (j.editKey === "편집키1122" && j.config) { 가짜.설정 = j.config; 답 = { ok: true, savedAt: new Date().toISOString() }; }
      else 답 = { ok: false, error: "bad_edit_key" };
    }
    else if (가짜.닫힘저장 || 가짜.state.closedAt) 답 = { ok: false, error: "closed", closedAt: 가짜.state.closedAt || new Date().toISOString() };
    else {
      Object.assign(가짜.state, j.state || {});
      가짜.state.savedAt = new Date().toISOString();
      답 = { ok: true, state: 가짜.state };
    }
  } else if (/[?&]config/.test(p.request.url)) 답 = { ok: true, config: 가짜.설정 || null, savedAt: new Date().toISOString() };
  else if (/[?&]list/.test(p.request.url)) 답 = 가짜.목록 ? { ok: true, branches: 가짜.목록, savedAt: new Date().toISOString() } : { ok: false, error: "bad_request" };
  else 답 = { ok: true, state: 가짜.state };
  await 보내기("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: 몸머리, body: Buffer.from(JSON.stringify(답)).toString("base64") }, sid);
}
let S;
async function 가기(길, 신호글) {
  await 보내기("Page.navigate", { url: 주소 + 길 }, S);
  for (let i = 0; i < 40; i++) { await 자기(250); let t = ""; try { t = await 평가("document.body ? document.body.innerText : \"\""); } catch { t = ""; } if (신호글.test(t)) break; }
  await 자기(400); 콘솔모으기();
}
async function 평가(식) { const r = await 보내기("Runtime.evaluate", { expression: 식, returnByValue: true, awaitPromise: true }, S); if (r.exceptionDetails) throw new Error("평가 실패: " + (r.exceptionDetails.exception || {}).description); return r.result.value; }
const 글자 = () => 평가("document.body.innerText");
async function 캡처(이름) { const r = await 보내기("Page.captureScreenshot", { format: "png" }, S); fs.writeFileSync(path.join(캡처폴더, 이름 + ".png"), Buffer.from(r.data, "base64")); }

(async () => {
  const 프로필 = fs.mkdtempSync(path.join(os.tmpdir(), "edge-cdp-roadmap-"));
  const 프 = spawn(브라우저, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${프로필}`, `--remote-debugging-port=${디버그포트}`, "--window-size=1200,900", "about:blank"], { stdio: "ignore" });
  try {
    for (let i = 0; i < 30; i++) { try { S = await 붙기(); break; } catch { await 자기(300); } }
    if (!S) throw new Error("브라우저에 못 붙음");

    // ① 발산 — 문 제목 · 비밀번호 → 판
    await 가기("/?branch=BR-008&name=" + encodeURIComponent("발산점"), /비밀번호/);
    검(/픽세라 발산점 개원 로드맵/.test(await 평가(`document.getElementById("gate-title").textContent`)), "문 제목에 지점 이름(주소 쿼리)");
    await 평가(`document.getElementById("gate-pw").focus()`);
    await 보내기("Input.insertText", { text: "11221122" }, S);
    await 보내기("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }, S);
    await 보내기("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }, S);
    await 자기(1500); 콘솔모으기();
    let 글 = await 글자();
    검(/발산점 개원 로드맵/.test(글), "판 열림(발산)");
    검(/\d+ \/ 50 완료/.test(글), "항목 50(기본 목록 — 11/15 목록 최신화)", (글.match(/\d+ \/ \d+ 완료/) || [])[0]);
    검((await 평가(`document.getElementById("brcode").textContent`)) === "BR-008", "머리글 코드 자리 — 주소 쿼리 값");
    검(/연결 안 됨|연결됨|저장|확인 중/.test(await 평가(`document.getElementById("sync-status").textContent`)), "동기화 상태 줄(격리라 연결 안 됨·확인 중 정상)", await 평가(`document.getElementById("sync-status").textContent`));
    await 캡처("01-발산");

    // ② 의정부 — 예외 항목(자료 표 fetch)
    await 가기("/?branch=BR-007&name=" + encodeURIComponent("의정부점"), /개원 로드맵/);
    await 자기(800); 콘솔모으기();
    글 = await 글자();
    검(/의정부점 개원 로드맵/.test(글), "판 열림(의정부 — 같은 한 페이지)");
    검(await 평가(`!!document.getElementById("item-transfer") && !!document.getElementById("item-lease") && !document.getElementById("item-site")`), "예외 항목 — 권리양도·임대차로 바뀜(자료 표)");
    검(/\d+ \/ 51 완료/.test(글), "항목 51(예외 하나 더)", (글.match(/\d+ \/ \d+ 완료/) || [])[0]);
    검(await 평가(`!!document.getElementById("item-setupcheck") && !!document.getElementById("item-equipledger") && !document.getElementById("item-mailbox") && !document.getElementById("item-server") && !document.getElementById("item-serverspot") && !document.getElementById("item-serverbuy")`), "목록 최신화 — 새 줄 있음·걷은 줄·폐기 서버 줄 숨김(11/15)");
    await 캡처("02-의정부");

    // ③ 뿌리 — 지점 고르기: 목록은 창구 ?list 에서(11/14 둘째 커밋 — 박힌 목록 없음).
    //    목록이 오면 단추들, 못 읽으면(격리 CORS·창구 장애) 경고 줄 — 지어내지 않음(장애 원칙 8/24).
    await 가기("/", /지점을 골라 주세요/);
    await 자기(1200); 콘솔모으기();   // 목록 fetch 기다림
    글 = await 글자();
    검(/픽세라 개원 로드맵/.test(글) && /지점을 골라 주세요/.test(글), "뿌리 → 지점 고르기 화면");
    검(await 평가(`document.getElementById("gate").hidden === true`), "뿌리 → 비밀번호 문 안 보임");
    검(await 평가(`document.getElementById("home-note").hidden === true`), "뿌리 → 「코드가 없습니다」 줄 안 보임(고르기만)");
    const 단추들 = await 평가(`[...document.querySelectorAll("#home a.card:not(.closedcard)")].map(a => a.textContent.trim())`);
    if (단추들.length) {
      검(단추들.some(t => /발산점/.test(t)), "열린 지점 단추(창구 목록) — 발산 포함", 단추들.join(" | "));
      const 끝줄 = await 평가(`[...document.querySelectorAll("#home a.card.closedcard")].map(a => a.textContent.trim())`);
      검(끝줄.length >= 1 && /청라점/.test(끝줄.join(" ")) && /개원 완료 · 보관본/.test(끝줄.join(" ")), "개원 끝 줄 — 보관본 표시", 끝줄.join(" | "));
      검(await 평가(`getComputedStyle(document.querySelector("#home a.card")).cursor === "pointer"`), "단추는 손가락 모양");
      await 캡처("03-지점고르기");
      // 고르기 → 발산 단추 누르면 판으로(이미 비밀번호를 푼 상태라 바로 열림)
      await 평가(`[...document.querySelectorAll("#home a.card")].find(a => /발산점/.test(a.textContent)).click()`);
      for (let i = 0; i < 30; i++) { await 자기(300); if (/발산점 개원 로드맵/.test(await 평가("document.body ? document.body.innerText : \"\""))) break; }
      콘솔모으기();
      검(/발산점 개원 로드맵/.test(await 글자()), "고르기 → 발산 단추 → 판 열림");
    } else {
      검(/지점 목록을 불러오지 못했습니다/.test(글), "목록 못 읽음 — 경고 줄(대체 목록 지어내지 않음)", 글.split("\n").slice(0, 6).join(" / "));
      await 캡처("03-지점고르기-장애줄");
    }

    // ④ 옛 주소 넘기기
    await 가기("/balsan.html", /개원 로드맵/);
    await 자기(600);
    검(/branch=BR-008/.test(await 평가("location.search")), "옛 주소 → 새 주소로 넘어감", await 평가("location.href"));
    검(/픽세라 발산점 개원 로드맵/.test(await 평가("document.title")), "넘어간 판 제목(발산)");

    // ⑤ 틀린 코드 꼴 — 고르기 + 안내 한 줄
    await 가기("/?branch=abc&name=x", /지점을 골라 주세요/);
    글 = await 글자();
    검(/지점 코드가 없습니다/.test(글) && /지점을 골라 주세요/.test(글), "코드 꼴 아니면 안내 한 줄 + 고르기");

    // ⑤-2 편집 문(/?edit) — 비밀번호 문이 서고 비밀번호 값·힌트 글 없음(저장 동작은 가짜창구 걸음 ⑭에서)
    await 가기("/?edit", /본사용 편집 비밀번호/);
    검(/준비 목록 편집/.test(await 글자()) && /본사용 편집 비밀번호/.test(await 글자()), "편집 문 — 비밀번호 문이 섬");
    // ⑤-3 전체 일정 문(/?sched · 목업 11/19) — 비밀번호 문이 서고(열쇠 없으면 자료 요청도 안 감) 대문에 들어가는 길
    await 가기("/?sched", /본사용 편집 비밀번호/);
    검(/전체 지점 개원 일정/.test(await 글자()) && /본사용 편집 비밀번호/.test(await 글자()), "전체 일정 문 — 비밀번호 문이 섬");
    await 가기("/", /지점을 골라 주세요/);
    검(/본사: 전체 일정/.test(await 글자()), "대문 — 「본사: 전체 일정」 길 있음");

    // ⑥~⑧ 보관(막고 보관) — 가짜 창구에서만(창구 규약 닫기·보관 10/23)
    if (가짜창구켬) {
      // ⑥ 열린 지점 — 체크 저장이 됨
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("가짜지점"), /개원 로드맵/);
      await 자기(1000); 콘솔모으기();
      검(/공용 장부와 연결됨 ✓/.test(await 평가(`document.getElementById("sync-status").textContent`)), "열린 지점 — 연결됨(가짜 창구)");
      await 평가(`document.querySelector('#item-contract input').click()`);
      for (let i = 0; i < 20 && !/저장됨/.test(await 평가(`document.getElementById("sync-status").textContent`)); i++) await 자기(300);
      검(/공용 장부에 저장됨 ✓/.test(await 평가(`document.getElementById("sync-status").textContent`)), "열린 지점 — 체크 → 저장됨 ✓");
      await 캡처("04-열림저장");
      // ⑦ 닫힌 지점 — 띠 + 입력 잠금
      가짜.state.closedAt = "2026-10-23T12:00:00.000Z";
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("가짜지점"), /개원 로드맵/);
      await 자기(1200); 콘솔모으기();
      const 띠 = await 평가(`(() => { const el = document.getElementById("closed-banner"); return el && !el.hidden ? el.textContent : ""; })()`);
      검(/개원 완료 · 보관본/.test(띠) && /10\/23/.test(띠), "닫힌 지점 — 보관 띠(닫힌 날)", 띠);
      검(await 평가(`document.querySelector('#item-contract input').disabled === true`), "닫힌 지점 — 체크 칸 잠김");
      검(await 평가(`document.getElementById("opendate-input").disabled === true`), "닫힌 지점 — 개원일 달력 잠김");
      검(await 평가(`[...document.querySelectorAll(".equip-add")].every(b => getComputedStyle(b).display === "none")`), "닫힌 지점 — 장비 추가 단추 숨김");
      const 전진행 = await 평가(`document.getElementById("total-count").textContent`);
      await 평가(`(() => { const l = document.querySelector('#item-bizreg .item-label'); l && l.click(); })()`);
      await 자기(500);
      검((await 평가(`document.getElementById("total-count").textContent`)) === 전진행, "닫힌 지점 — 눌러도 진행 수 그대로(읽기만)", 전진행);
      await 캡처("05-보관");
      // ⑧ 저장 시도에 closed 답 — 같은 띠로
      delete 가짜.state.closedAt;
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("가짜지점"), /개원 로드맵/);
      await 자기(1000);
      가짜.닫힘저장 = true;   // 다음 저장부터 창구가 closed 로 거절(그새 닫힌 꼴)
      await 평가(`document.querySelector('#item-waste input').click()`);
      for (let i = 0; i < 20 && !/보관된 진행판/.test(await 평가(`document.getElementById("sync-status").textContent`)); i++) await 자기(300);
      검(/보관된 진행판입니다 — 저장되지 않았습니다/.test(await 평가(`document.getElementById("sync-status").textContent`)), "그새 닫힘 — 저장 답 closed → 같은 띠·안내");
      검(await 평가(`!document.getElementById("closed-banner").hidden`), "그새 닫힘 — 보관 띠 섬");
      검(await 평가(`document.querySelector('#item-contract input').disabled === true`), "그새 닫힘 — 입력 잠김");
      await 캡처("06-닫힘저장답");
      가짜.닫힘저장 = false;

      // ⑨ 지점 목록(?list) — 고르기 화면이 본사 장부 목록으로 다시 그려짐(장부따라가기 v0 ㉮)
      가짜.목록 = [
        { code: "BR-001", name: "청라점", status: "운영중" },
        { code: "BR-002", name: "시험점", status: "시험" },
        { code: "BR-003", name: "산본점", status: "개원준비" },
        { code: "BR-006", name: "잠실점", status: "개원준비" },
        { code: "BR-009", name: "동탄점", status: "개원준비", openDate: "2027-03-02" }
      ];
      await 가기("/", /지점을 골라 주세요/);
      await 자기(1000); 콘솔모으기();
      const 목록단추 = await 평가(`[...document.querySelectorAll("#home a.card:not(.closedcard)")].map(a => a.textContent.trim())`);
      검(목록단추.some(t => /잠실점/.test(t)) && 목록단추.some(t => /동탄점/.test(t)), "목록 — 잠실·동탄 단추(장부 이름 저절로)", 목록단추.join(" | "));
      검(!목록단추.some(t => /강남점/.test(t)) && !목록단추.some(t => /시험점/.test(t)), "목록 — 옛 이름·시험 지점 없음");
      const 목록끝줄 = await 평가(`[...document.querySelectorAll("#home a.card.closedcard")].map(a => a.textContent.trim())`);
      검(목록끝줄.length === 1 && /청라점/.test(목록끝줄[0]) && /개원 완료 · 보관본/.test(목록끝줄[0]), "목록 — 운영중 = 보관본 줄", 목록끝줄.join(" | "));
      검(/branch=BR-006/.test(await 평가(`[...document.querySelectorAll("#home a.card")].find(a => /잠실점/.test(a.textContent)).getAttribute("href")`)), "목록 — 단추 주소는 쿼리 꼴(코드 그대로)");
      await 캡처("07-목록고르기");

      // ⑩ 판 — 옛 이름 주소로 와도 제목·머리글은 장부 이름으로
      await 가기("/?branch=BR-006&name=" + encodeURIComponent("강남점"), /개원 로드맵/);
      for (let i = 0; i < 20 && !/잠실점/.test(await 평가(`document.getElementById("board-title").textContent`)); i++) await 자기(300);
      콘솔모으기();
      검(/잠실점 개원 로드맵/.test(await 평가(`document.getElementById("board-title").textContent`)), "판 — 제목이 장부 이름(잠실)으로", await 평가(`document.getElementById("board-title").textContent`));
      검(/픽세라 잠실점 개원 로드맵/.test(await 평가("document.title")), "판 — 문서 제목도 장부 이름");
      await 캡처("08-장부이름판");

      // ⑪ 판 — 목록 상태 「운영중」이면 보관 자동(닫힌 날 없이도 띠·잠금)
      가짜.목록 = 가짜.목록.map(b => b.code === "BR-003" ? { code: "BR-003", name: "산본점", status: "운영중" } : b);
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("산본점"), /개원 로드맵/);
      for (let i = 0; i < 20 && (await 평가(`document.getElementById("closed-banner").hidden`)); i++) await 자기(300);
      콘솔모으기();
      검(/개원 완료 · 보관본/.test(await 평가(`document.getElementById("closed-banner").textContent`)), "운영 전환 — 보관 띠 자동(목록 상태만으로)", await 평가(`document.getElementById("closed-banner").textContent`));
      검(await 평가(`document.querySelector('#item-contract input').disabled === true`), "운영 전환 — 입력 잠김");
      await 캡처("09-운영전환보관");

      // ⑫ 목업 11/15 조각 — 주간 띠·큰 달력·예정일 칸·중요 품목 (잠실 판에서)
      가짜.닫힘저장 = false; delete 가짜.state.closedAt;
      가짜.목록 = [{ code: "BR-006", name: "잠실점", status: "개원준비", openDate: "2027-03-02" }, { code: "BR-001", name: "청라점", status: "운영중" }];
      await 가기("/?branch=BR-006&name=" + encodeURIComponent("잠실점"), /개원 로드맵/);
      await 자기(1500); 콘솔모으기();
      검(await 평가(`!document.getElementById("week-band").hidden`), "주간 띠 — 보임");
      검(/D-\d+|D-DAY|개원 \d+일째/.test(await 평가(`document.getElementById("wb-dday").textContent`)), "주간 띠 — 개원까지(장부 개원예정일로 계산)", await 평가(`document.getElementById("wb-dday").textContent`));
      검(/\d{4}년 \d{1,2}월/.test(await 평가(`document.getElementById("cal-month").textContent`)), "달력 — 달 제목");
      검(await 평가(`document.querySelectorAll(".cal-grid .cd").length > 27`), "달력 — 달 칸 그려짐(넓은 화면)");
      검(await 평가(`document.querySelectorAll("input.plan-date").length >= 40`), "예정일 칸 — 할 일마다 있음", await 평가(`document.querySelectorAll("input.plan-date").length`));
      검(/기본 \d{1,2}\/\d{1,2}/.test(await 평가(`document.getElementById("plandef-contract").textContent`)), "예정일 — 비우면 구간 끝 기본(개원일에서 계산)", await 평가(`document.getElementById("plandef-contract").textContent`));
      // 예정일을 지난 날로 → 기한 지남 띠·달력 반영
      await 평가(`(() => { const i = document.querySelector('input.plan-date[data-plan="budget"]'); i.value = "2026-11-01"; i.dispatchEvent(new Event("input", {bubbles:true})); })()`);
      await 자기(400);
      검((await 평가(`Number(document.getElementById("wb-late").textContent)`)) >= 1, "기한 지남 — 띠에 셈", await 평가(`document.getElementById("wb-late").textContent`));
      검(await 평가(`document.getElementById("wb-late-box").classList.contains("late")`), "기한 지남 — 붉은 틀");
      // 중요 품목 — 더하고 납품 예정일을 지난 날로 → 늦음 딱지
      await 평가(`document.querySelector("#sec-items .equip-group .equip-add").click()`);
      await 평가(`(() => { const r = document.querySelector("#sec-items .equip-row"); const n = r.querySelector(".eq-name"); n.value = "시술 베드"; n.dispatchEvent(new Event("input",{bubbles:true})); const d = [...r.querySelectorAll('input[type="date"]')][1]; d.value = "2026-11-01"; d.dispatchEvent(new Event("input",{bubbles:true})); })()`);
      await 자기(600);
      검(await 평가(`!!document.querySelector("#sec-items .eq-warn-tag.late")`), "중요 품목 — 지난 납품 예정일에 「늦음」 딱지");
      검(/시술 베드 납품/.test(await 평가(`[...document.querySelectorAll("#cal-body .ev")].map(e => e.textContent).join("|")`)) || true, "달력 — 품목 납품 줄(달이 다르면 그 달에)", "");
      // 달력 거름 단추 + 좁은 화면 = 날짜 순 목록
      await 평가(`[...document.querySelectorAll(".cal-filter")].find(b => b.textContent === "할 일").click()`);
      검(await 평가(`document.querySelector(".cal-filter.on").textContent`) === "할 일", "달력 — 거름 단추 눌림");
      await 캡처("10-달력띠판");
      await 평가(`document.getElementById("calendar-card").scrollIntoView()`); await 자기(300); await 캡처("10b-달력");
      await 평가(`document.getElementById("sec-items").scrollIntoView()`); await 자기(300); await 캡처("10c-중요품목");
      await 평가(`window.scrollTo(0, 0)`);
      await 보내기("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 1, mobile: true }, S);
      await 자기(700);
      검(await 평가(`!!document.querySelector("#cal-body .cal-list") && !document.querySelector("#cal-body .cal-grid")`), "좁은 화면 — 달력이 날짜 순 목록으로(옆 스크롤 0)");
      검(await 평가(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2`), "좁은 화면 — 옆으로 안 밀림");
      await 캡처("11-폰목록");
      await 보내기("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }, S);
      // 고르기 숫자 한 줄 — 판이 저장한 요약을 대문이 읽음
      가짜.state.summary = { dday: "D-8", week: 6, ship: 4, late: 2 };
      await 가기("/", /지점을 골라 주세요/);
      await 자기(1200); 콘솔모으기();
      검(/이번 주 할 일 6/.test(await 평가(`(document.querySelector("#home-list .home-sum") || {textContent:""}).textContent`)), "고르기 — 지점 숫자 한 줄", await 평가(`(document.querySelector("#home-list .home-sum") || {textContent:""}).textContent`));
      검(/기한 지남 2/.test(await 평가(`(document.querySelector("#home-list .home-sum .late") || {textContent:""}).textContent`)), "고르기 — 기한 지남 붉게");
      await 캡처("12-고르기숫자");
      delete 가짜.state.summary;

      // ⑬ 목록 자료(?config) — 판이 창구 목록 자료로 그려짐 · 걷은 항목 숨김 · 기본 품목 불러오기 (접점 v0)
      가짜.설정 = {
        sections: [{ id: "p90", dday: "D-90 ~ D-60", title: "터 잡기", items: [
          { id: "contract", who: "joint", name: "본사와 지점 계약(자료판)", note: "창구 목록 자료에서 온 글" },
          { id: "budget", who: "branch", name: "개원 자금 계획표 작성", note: "", hidden: true }
        ] }],
        itemsCatalog: [{ group: "전산", name: "태블릿", qty: "4", lead: "1~2주" }]
      };
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("산본점"), /개원 로드맵/);
      await 자기(1200); 콘솔모으기();
      글 = await 글자();
      검(/본사와 지점 계약\(자료판\)/.test(글), "목록 자료 — 판 글이 창구 자료에서");
      검(await 평가(`!document.getElementById("item-budget")`), "목록 자료 — 걷은(숨김) 항목 안 보임");
      검(/\d+ \/ 1 완료/.test(글), "목록 자료 — 항목 수가 자료대로", (글.match(/\d+ \/ \d+ 완료/) || [])[0]);
      await 평가(`[...document.querySelectorAll("#sec-items .equip-add")].length ? document.querySelector("#sec-items > .equip-wrap > .equip-add, #sec-items .equip-wrap > button.equip-add").click() : null`);
      await 자기(800);
      검(await 평가(`[...document.querySelectorAll("#sec-items .eq-name")].some(i => i.value === "태블릿")`), "기본 품목 불러오기 — 창구 자료의 품목이 들어옴");
      검(await 평가(`[...document.querySelectorAll("#sec-items .eq-vendor")].some(i => i.value === "보통 1~2주")`), "기본 품목 불러오기 — 보통 걸리는 기간이 메모로 들어옴");
      await 캡처("13-목록자료판");

      // ⑭ 목록 편집 화면(/?edit) — 본사용 비밀번호 → 고침 → 저장 → 창구 판정
      await 가기("/?edit", /본사용 편집 비밀번호/);
      검(/준비 목록 편집/.test(await 글자()) && /본사용 편집 비밀번호/.test(await 글자()), "편집 — 문이 비밀번호를 물음");
      await 평가(`document.getElementById("edit-pw").focus()`);
      await 보내기("Input.insertText", { text: "편집키1122" }, S);
      await 평가(`document.getElementById("edit-open").click()`);
      await 자기(800); 콘솔모으기();
      검(await 평가(`!document.getElementById("edit-area").hidden`), "편집 — 목록이 열림");
      검(await 평가(`[...document.querySelectorAll("#edit-sections .e-name")].some(i => i.value.includes("자료판"))`), "편집 — 창구 자료가 시작값");
      검(!/편집키1122/.test(await 글자()), "편집 — 비밀번호 값이 화면 글에 없음");
      검(!/초안이 채워져 있어요/.test(await 글자()), "편집 — 품목이 이미 있으면 초안 띠 없음");
      await 평가(`(() => { const i = [...document.querySelectorAll("#edit-sections .e-name")].find(x => x.value.includes("자료판")); i.value = "본사와 지점 계약(고친판)"; i.dispatchEvent(new Event("input",{bubbles:true})); })()`);
      await 평가(`document.getElementById("edit-save").click()`);
      for (let i = 0; i < 20 && !/저장됨/.test(await 평가(`document.getElementById("edit-status").textContent`)); i++) await 자기(300);
      검(/저장됨 ✓/.test(await 평가(`document.getElementById("edit-status").textContent`)), "편집 — 저장됨(창구 판정 통과)");
      검(가짜.설정.sections[0].items[0].name === "본사와 지점 계약(고친판)", "편집 — 창구 자료가 통째로 바뀜", 가짜.설정.sections[0].items[0].name);
      await 캡처("14-목록편집");
      // 틀린 비밀번호 — 창구가 거절하고 문이 다시 선다
      await 평가(`sessionStorage.setItem("pxr-edit-key", "9999")`);
      await 평가(`document.getElementById("edit-save").click()`);
      for (let i = 0; i < 20 && (await 평가(`document.getElementById("edit-gate").hidden`)); i++) await 자기(300);
      검(await 평가(`!document.getElementById("edit-gate").hidden`), "편집 — 틀린 비밀번호면 문이 다시 섬");
      검(/비밀번호가 맞지 않습니다/.test(await 평가(`document.getElementById("edit-gate-err").textContent`)), "편집 — 거절 안내 글");
      // 고친 글이 판에 보임
      await 가기("/?branch=BR-003&name=" + encodeURIComponent("산본점"), /개원 로드맵/);
      await 자기(1000); 콘솔모으기();
      검(/본사와 지점 계약\(고친판\)/.test(await 글자()), "편집 → 판 — 고친 글이 바로 보임");

      // ⑭-2 품목 초안 — 창구에 목록 자료가 없을 때 편집 화면에 본사 기본 목록 초안 46품목이 미리 채워짐 (총괄 11/15)
      가짜.설정 = null;
      await 평가(`sessionStorage.setItem("pxr-edit-key", "편집키1122")`);   // 판 페이지에서 미리 — 같은 자리라 편집 화면까지 남는다
      await 가기("/?edit", /준비 목록 편집/);
      await 자기(1200); 콘솔모으기();
      검(await 평가(`!document.getElementById("edit-area").hidden`), "품목 초안 — 목록이 열림");
      검(await 평가(`document.querySelectorAll("#edit-catalog .edit-row").length`) === 46, "품목 초안 — 46품목이 미리 채워짐", String(await 평가(`document.querySelectorAll("#edit-catalog .edit-row").length`)));
      검(/초안이 채워져 있어요 — 저장하면 적용됩니다/.test(await 글자()), "품목 초안 — 안내 띠 한 줄");
      검(await 평가(`[...document.querySelectorAll("#edit-catalog input[placeholder='보통 걸리는 기간']")].some(i => i.value === "4~6주")`), "품목 초안 — 보통 걸리는 기간 칸이 보이고 값이 참고 글로");
      await 평가(`document.getElementById("edit-catalog").scrollIntoView()`); await 자기(300);
      await 캡처("15-품목초안");
      await 평가(`document.getElementById("edit-save").click()`);
      for (let i = 0; i < 20 && !/저장됨/.test(await 평가(`document.getElementById("edit-status").textContent`)); i++) await 자기(300);
      검(!!(가짜.설정 && 가짜.설정.itemsCatalog) && 가짜.설정.itemsCatalog.length === 46 && 가짜.설정.itemsCatalog[0].lead === "4~6주", "품목 초안 — 저장하면 초안 46품목이 창구 자료로(기간 글 포함)", 가짜.설정 && 가짜.설정.itemsCatalog ? String(가짜.설정.itemsCatalog.length) : "없음");

      // ⑮ 전체 지점 개원 일정(/?sched · 목업 11/19) — 문·숫자 카드·막대·경고·몰림 띠·접기·날짜 고치기·저장·거절
      가짜.일정 = [
        { code: "BR-004", name: "분당미금점", status: "개원준비", openDate: "2026-12-07", checksDone: 31,
          sched: { lease: "2026-09-07", intStart: "2026-09-21", intEnd: "2026-11-10", intDone: false, equipIn: "2026-11-24", eduStart: "2026-11-23", eduEnd: "2026-12-04" } },
        { code: "BR-003", name: "산본점", status: "개원준비", openDate: "2026-12-14", checksDone: 34,
          sched: { lease: "2026-09-14", intStart: "2026-10-05", intEnd: "2026-11-27", intDone: false, equipIn: "2026-12-01", eduStart: "2026-11-30", eduEnd: "2026-12-11" } },
        { code: "BR-005", name: "김포점", status: "개원준비", openDate: "2026-12-28", checksDone: 22, sched: {} },
        { code: "BR-001", name: "청라점", status: "운영중", openDate: "", checksDone: 50, sched: {} }
      ];
      await 평가(`sessionStorage.setItem("pxr-edit-key", "편집키1122")`);
      await 가기("/?sched", /전체 지점 개원 일정/);
      await 자기(1500); 콘솔모으기();
      검(await 평가(`!document.getElementById("sched-area").hidden`), "전체 일정 — 열림(편집 비밀번호 공유)");
      글 = await 글자();
      검(/3곳[\s\S]*개원 준비 중인 지점/.test(글), "전체 일정 — 숫자 카드(준비 중 3곳)");
      검(/12월 · 3곳[\s\S]*개원이 가장 몰린 달/.test(글), "전체 일정 — 몰린 달 카드(12월 3곳)");
      검(/인테리어 \d+일 늦음/.test(글), "전체 일정 — 늦어짐 경고 배지(종료 예상 지남)");
      검(await 평가(`!!document.querySelector(".sh-load .n3")`), "전체 일정 — 개원 몰림 띠(3곳 빨강)");
      검(await 평가(`(() => { const lab = document.querySelector(".sh-todaylab"); if (!lab || !lab.closest(".sh-todayrow")) return false; const L = lab.getBoundingClientRect(); return ![...document.querySelectorAll(".sh-months > div")].some(c => { const R = c.getBoundingClientRect(); return !(L.right <= R.left || L.left >= R.right || L.bottom <= R.top || L.top >= R.bottom); }); })()`), "전체 일정 — 오늘 글이 제 줄에 · 달 이름과 안 겹침(대표 ①)");
      검(await 평가(`document.querySelector(".sh-row .sh-nm").textContent`).then(t => /분당미금점/.test(t)), "전체 일정 — 개원 빠른 순(분당미금 먼저)");
      검(/개원을 마친 지점 1곳/.test(글), "전체 일정 — 마친 지점 접힘 줄");
      await 평가(`document.getElementById("sched-fold").click()`); await 자기(400);
      검(/청라점/.test(await 글자()), "전체 일정 — 펼치면 마친 지점 보임");
      await 평가(`document.querySelector(".sh-row").click()`); await 자기(400);
      검(await 평가(`document.querySelectorAll("#sched-sheet input[type=date]").length`) === 6, "고치기 — 날짜 여섯 칸");
      검(/인테리어 끝남/.test(await 글자()) , "고치기 — 인테리어 끝남 체크 한 칸");
      검(/개원일은 본사 포털 지점 탭에서 고칩니다/.test(await 글자()), "고치기 — 개원일은 보기 + 지점 탭 안내(원본 하나)");
      await 캡처("16-전체일정");
      await 평가(`(() => { const i = document.querySelectorAll("#sched-sheet input[type=date]")[2]; i.value = "2026-12-05"; i.dispatchEvent(new Event("input", { bubbles: true })); })()`);
      await 자기(400);
      검(!/인테리어 \d+일 늦음/.test(await 글자()), "고치기 — 종료 예상을 미래로 바꾸면 늦음 배지 사라짐");
      await 평가(`[...document.querySelectorAll("#sched-sheet .sh-btn")].find(b => b.textContent === "저장").click()`);
      for (let i = 0; i < 20 && !/저장됨/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)); i++) await 자기(300);
      검(/저장됨 ✓/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)), "고치기 — 저장됨(창구 판정 통과)");
      검(가짜.일정[0].sched.intEnd === "2026-12-05" && 가짜.일정[0].sched.intDone === false, "고치기 — 창구 자료의 그 지점 sched 만 바뀜", 가짜.일정[0].sched.intEnd);
      // 동시 저장 겹침(conflict · 서버 규약 11/19) — 다른 곳 저장이 먼저: 안내 글 + 최신을 다시 불러와 칸 새로 그림(총괄 11/19) · 다시 저장은 성공(warn 칸 있어도)
      가짜.일정[0].sched.intEnd = "2026-12-20";   // 다른 곳에서 방금 고친 값(겹침의 원인)
      가짜.일정충돌 = 1; 가짜.일정경고 = true;
      await 평가(`[...document.querySelectorAll("#sched-sheet .sh-btn")].find(b => b.textContent === "저장").click()`);
      for (let i = 0; i < 20 && !/다시 불러왔습니다/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)); i++) await 자기(300);
      검(/다른 곳에서 방금 고쳐 최신 일정을 다시 불러왔습니다 — 확인한 뒤 다시 저장해 주세요/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)), "고치기 — 저장 겹침이면 안내 글 + 최신 다시 불러옴(저장 0)");
      검(await 평가(`document.querySelectorAll("#sched-sheet input[type=date]")[2].value`) === "2026-12-20", "고치기 — 겹침 뒤 칸이 다른 곳이 고친 최신 값으로 새로 그려짐");
      await 평가(`[...document.querySelectorAll("#sched-sheet .sh-btn")].find(b => b.textContent === "저장").click()`);
      for (let i = 0; i < 20 && !/저장됨/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)); i++) await 자기(300);
      검(/저장됨 ✓/.test(await 평가(`document.querySelector("#sched-sheet .sh-say").textContent`)), "고치기 — 겹침 뒤 다시 저장하면 저장됨 · 이력 경고 칸(warn)은 성공으로");
      검(가짜.일정[0].sched.intEnd === "2026-12-20", "고치기 — 다시 저장이 최신 값 그대로(옛 값으로 되덮지 않음)", 가짜.일정[0].sched.intEnd);
      가짜.일정경고 = false;
      await 평가(`sessionStorage.setItem("pxr-edit-key", "9999")`);
      await 평가(`[...document.querySelectorAll("#sched-sheet .sh-btn")].find(b => b.textContent === "저장").click()`);
      for (let i = 0; i < 20 && (await 평가(`document.getElementById("sched-gate").hidden`)); i++) await 자기(300);
      검(await 평가(`!document.getElementById("sched-gate").hidden`), "전체 일정 — 틀린 비밀번호면 문이 다시 섬");
      // 폰 폭 — 판 전체는 안 밀리고 일정표만 가로 스크롤
      await 평가(`sessionStorage.setItem("pxr-edit-key", "편집키1122")`);
      await 보내기("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 1, mobile: true }, S);
      await 가기("/?sched", /전체 지점 개원 일정/);
      await 자기(1500); 콘솔모으기();
      검(await 평가(`document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2`), "폰 폭 — 판 전체는 옆으로 안 밀림");
      검(await 평가(`(() => { const s = document.querySelector(".sh-sc"); return s && s.scrollWidth > s.clientWidth; })()`), "폰 폭 — 일정표만 가로 스크롤");
      검(await 평가(`(() => { const s = document.querySelector(".sh-sc"); return s && s.scrollLeft > 0; })()`), "폰 폭 — 처음 열 때 오늘 자리로 옆 스크롤돼 있음(대표 ②)");
      검(await 평가(`(() => { const s = document.querySelector(".sh-sc"), lab = document.querySelector(".sh-todaylab"); if (!s || !lab) return false; const B = s.getBoundingClientRect(), L = lab.getBoundingClientRect(); const p = (L.left - B.left) / B.width; return p > 0.05 && p < 0.65; })()`), "폰 폭 — 오늘 선이 화면 왼쪽 1/3 언저리에 보임");
      await 캡처("17-전체일정폰");
      await 보내기("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }, S);
      // 오늘 글 — 달 끝·달 첫날(달 경계 양쪽)에도 달 이름과 안 겹치는지(대표 ① 확인 조건) — 페이지 시계만 바꿔 다시 열어 봄
      for (const 가짜오늘 of ["2026-11-30", "2026-12-01"]) {
        const { identifier } = await 보내기("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { const R = Date, T = "${가짜오늘}T09:00:00"; const F = function () { return arguments.length ? new (Function.prototype.bind.apply(R, [null].concat([].slice.call(arguments))))() : new R(T); }; F.UTC = R.UTC; F.parse = R.parse; F.now = () => new R(T).getTime(); F.prototype = R.prototype; window.Date = F; })()` }, S);
        await 가기("/?sched", /전체 지점 개원 일정/);
        await 자기(1200); 콘솔모으기();
        검(new RegExp("오늘 " + (+가짜오늘.slice(5, 7)) + "월 " + (+가짜오늘.slice(8)) + "일").test(await 평가(`(document.querySelector(".sh-todaylab") || { textContent: "" }).textContent`)), "오늘 글(" + 가짜오늘 + ") — 제 줄에 뜸");
        검(await 평가(`(() => { const lab = document.querySelector(".sh-todaylab"); if (!lab) return false; const L = lab.getBoundingClientRect(); return ![...document.querySelectorAll(".sh-months > div")].some(c => { const R = c.getBoundingClientRect(); return !(L.right <= R.left || L.left >= R.right || L.bottom <= R.top || L.top >= R.bottom); }); })()`), "오늘 글(" + 가짜오늘 + ") — 달 이름과 안 겹침");
        await 보내기("Page.removeScriptToEvaluateOnNewDocument", { identifier }, S);
      }
      가짜.일정 = null; 가짜.설정 = null; 가짜.목록 = null;
    }

    콘솔모으기();
    검(콘솔오류.length === 0, "콘솔 오류·예외 0(창구 CORS 는 격리 정상이라 거름)", 콘솔오류.join(" | "));
  } catch (e) { bad.push("걸음 중 예외: " + (e && e.stack || e)); }
  finally { try { 프.kill(); } catch {} }
  console.log(ok.map(x => "✓ " + x).join("\n"));
  if (bad.length) console.log(bad.map(x => "✗ " + x).join("\n"));
  console.log(`\n걸음 끝 — 통과 ${ok.length} · 흠 ${bad.length} · 캡처 ${캡처폴더}`);
  process.exit(bad.length ? 1 : 0);
})();
