// 진행판 화면 걸음 — 진짜 크로미움(Edge headless)을 원격 조종(CDP)해 한 페이지 판을 밟는다 (밟기 전 신호 금지 · 10/21 방식)
// ─────────────────────────────────────────────────────────────
// 전제: 로컬 미리보기 서버가 떠 있다(기본 http://127.0.0.1:8377 — npx http-server . -p 8377).
//   node source/화면걸음.js [--주소 http://127.0.0.1:8377] [--캡처폴더 <폴더>]
// 걸음: ① /?branch=BR-008&name=발산점 — 문 제목·비밀번호 → 판 열림·45항목·코드 표시 ② /?branch=BR-007&name=의정부점 — 예외 항목(권리양도)·46항목
//       ③ / — 「지점 코드가 없습니다」 ④ /balsan.html — 새 주소로 넘어감
// 격리(로컬)에서는 공용 장부 창구가 CORS 로 막혀 「연결 안 됨」이 정상 — 그 오류만 거르고 나머지 콘솔 오류는 0 이어야 통과.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const { spawn } = require("child_process");
const 인자 = process.argv.slice(2);
const 값 = (이름, 기본) => { const i = 인자.indexOf(이름); return i >= 0 && 인자[i + 1] ? 인자[i + 1] : 기본; };
const 주소 = 값("--주소", "http://127.0.0.1:8377");
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
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && 기다림.has(m.id)) { const w = 기다림.get(m.id); 기다림.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); } else if (m.method) 사건들.push(m); };
  const { targetId } = await 보내기("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await 보내기("Target.attachToTarget", { targetId, flatten: true });
  await 보내기("Page.enable", {}, sessionId); await 보내기("Runtime.enable", {}, sessionId); await 보내기("Log.enable", {}, sessionId);
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
    검(/0 \/ 45 완료|\d+ \/ 45 완료/.test(글), "항목 45(기본 목록)", (글.match(/\d+ \/ \d+ 완료/) || [])[0]);
    검((await 평가(`document.getElementById("brcode").textContent`)) === "BR-008", "머리글 코드 자리 — 주소 쿼리 값");
    검(/연결 안 됨|연결됨|저장|확인 중/.test(await 평가(`document.getElementById("sync-status").textContent`)), "동기화 상태 줄(격리라 연결 안 됨·확인 중 정상)", await 평가(`document.getElementById("sync-status").textContent`));
    await 캡처("01-발산");

    // ② 의정부 — 예외 항목(자료 표 fetch)
    await 가기("/?branch=BR-007&name=" + encodeURIComponent("의정부점"), /개원 로드맵/);
    await 자기(800); 콘솔모으기();
    글 = await 글자();
    검(/의정부점 개원 로드맵/.test(글), "판 열림(의정부 — 같은 한 페이지)");
    검(await 평가(`!!document.getElementById("item-transfer") && !!document.getElementById("item-lease") && !document.getElementById("item-site")`), "예외 항목 — 권리양도·임대차로 바뀜(자료 표)");
    검(/\d+ \/ 46 완료/.test(글), "항목 46(예외 하나 더)", (글.match(/\d+ \/ \d+ 완료/) || [])[0]);
    await 캡처("02-의정부");

    // ③ 쿼리 없음 — 안내 한 줄
    await 가기("/", /지점 코드가 없습니다/);
    검(/지점 코드가 없습니다/.test(await 글자()), "쿼리 없음 → 「지점 코드가 없습니다」 한 줄");
    검(await 평가(`document.getElementById("gate").hidden === true`), "쿼리 없음 → 비밀번호 문 안 보임");
    await 캡처("03-쿼리없음");

    // ④ 옛 주소 넘기기
    await 가기("/balsan.html", /개원 로드맵/);
    await 자기(600);
    검(/branch=BR-008/.test(await 평가("location.search")), "옛 주소 → 새 주소로 넘어감", await 평가("location.href"));
    검(/픽세라 발산점 개원 로드맵/.test(await 평가("document.title")), "넘어간 판 제목(발산)");

    // ⑤ 틀린 코드 꼴
    await 가기("/?branch=abc&name=x", /지점 코드가 없습니다/);
    검(/지점 코드가 없습니다/.test(await 글자()), "코드 꼴 아니면 같은 안내 한 줄");

    콘솔모으기();
    검(콘솔오류.length === 0, "콘솔 오류·예외 0(창구 CORS 는 격리 정상이라 거름)", 콘솔오류.join(" | "));
  } catch (e) { bad.push("걸음 중 예외: " + (e && e.stack || e)); }
  finally { try { 프.kill(); } catch {} }
  console.log(ok.map(x => "✓ " + x).join("\n"));
  if (bad.length) console.log(bad.map(x => "✗ " + x).join("\n"));
  console.log(`\n걸음 끝 — 통과 ${ok.length} · 흠 ${bad.length} · 캡처 ${캡처폴더}`);
  process.exit(bad.length ? 1 : 0);
})();
