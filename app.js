import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  serverTimestamp, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKZMu2HZPmmoZ1fFT7DNA9Q6ystbKEPgE",
  authDomain: "samnanger-g14-f10a1.firebaseapp.com",
  projectId: "samnanger-g14-f10a1",
  storageBucket: "samnanger-g14-f10a1.firebasestorage.app",
  messagingSenderId: "926427862844",
  appId: "1:926427862844:web:eeb814a349e9bfd701b039"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

const DEFAULT_PLAYERS = [
  "Ask", "Martin", "Brage", "Gabriel", "Sondre", "Nico", "Lars", "Snorre",
  "Sverre", "Liam", "Noah", "Lukas", "Oliver", "Nytveit", "Theodor", "Thage"
];

const LEVELS = [
  { max: 300000, key: "elite", label: "Ekstremt" },
  { max: 320000, key: "excellent", label: "Svært bra" },
  { max: 345000, key: "good", label: "Bra" },
  { max: 370000, key: "ok", label: "Greit" },
  { max: 400000, key: "improve", label: "Forbedringsrom" },
  { max: Infinity, key: "build", label: "Bygg kapasitet" }
];

const els = Object.fromEntries([
  "authGate","appRoot","loginForm","loginEmail","loginPassword","loginError","logoutBtn","cloudStatus",
  "setupPanel","livePanel","participantGrid","selectAllBtn","selectNoneBtn","selectedCount","quickAddForm","quickAddInput","startBtn",
  "finishedCount","totalCount","liveClock","clockTrackFill","liveHint","finishGrid","undoBtn","stopBtn",
  "playerFilter","resultStats","historyList","rosterAddForm","rosterAddInput","rosterList","resetRosterBtn",
  "countdownOverlay","countdownNumber","countdownText","toast"
].map(id => [id, document.getElementById(id)]));

let currentUser = null;
let roster = [...DEFAULT_PLAYERS];
let selectedPlayers = new Set(DEFAULT_PLAYERS);
let tests = [];
let liveTest = null;
let finishStack = [];
let timerHandle = null;
let wakeLock = null;
let writeQueue = Promise.resolve();
let toastTimer = null;
let audioCtx = null;
let testMode = false;
let cloudAvailable = true;

injectV3UI();

function injectV3UI() {
  const style = document.createElement("style");
  style.textContent = `
    .bronco-mode-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding:14px 16px;border:1px solid rgba(255,255,255,.09);border-radius:17px;background:rgba(255,255,255,.025)}
    .bronco-mode-copy strong{display:block;font-size:13px}.bronco-mode-copy small{display:block;color:var(--muted);font-size:11px;margin-top:3px;line-height:1.35}
    .bronco-switch{position:relative;width:54px;height:30px;flex:0 0 auto}.bronco-switch input{position:absolute;opacity:0;pointer-events:none}.bronco-switch span{position:absolute;inset:0;border-radius:999px;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);transition:.2s}.bronco-switch span:after{content:'';position:absolute;width:22px;height:22px;left:3px;top:3px;border-radius:50%;background:#f5f7fb;transition:.2s;box-shadow:0 4px 12px rgba(0,0,0,.25)}.bronco-switch input:checked+span{background:rgba(83,232,255,.2);border-color:rgba(83,232,255,.55)}.bronco-switch input:checked+span:after{transform:translateX(24px);background:var(--cyan)}
    .testmode-active .btn-start{background:linear-gradient(135deg,var(--cyan),#7ff5ff);box-shadow:0 15px 45px rgba(83,232,255,.16)}
    .testmode-active .btn-start:after{content:' · IKKE LAGRET'}
    .test-card-head-actions{display:flex;align-items:center;gap:10px}.delete-test-btn{min-height:34px;padding:0 11px;border:1px solid rgba(255,82,99,.34);border-radius:11px;background:rgba(255,82,99,.09);color:#ff8290;font-size:9px;font-weight:950;letter-spacing:.07em;cursor:pointer}.delete-test-btn:disabled{opacity:.45}
    .development-panel{margin:0 0 16px;padding:20px;border-radius:24px;overflow:hidden}.development-panel.is-hidden{display:none!important}.development-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:14px}.development-head h3{margin:2px 0 0;font-size:24px;letter-spacing:-.04em}.development-head p{margin:5px 0 0;color:var(--muted);font-size:11px}.development-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}.development-kpi{padding:12px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.025)}.development-kpi span{display:block;color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em}.development-kpi strong{display:block;margin-top:5px;font-size:20px;letter-spacing:-.04em}.development-kpi.good strong{color:var(--lime)}
    .chart-shell{position:relative;width:100%;overflow:hidden;border:1px solid rgba(255,255,255,.07);border-radius:18px;background:rgba(4,9,15,.35);padding:8px}.development-chart{display:block;width:100%;height:auto;min-height:220px}.chart-grid{stroke:rgba(255,255,255,.07);stroke-width:1}.chart-axis-label{fill:#8290a6;font-size:10px;font-weight:700}.chart-line{fill:none;stroke:#53e8ff;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(83,232,255,.24))}.chart-area{fill:url(#broncoArea)}.chart-point{fill:#c8ff3d;stroke:#071004;stroke-width:3}.chart-point.latest{fill:#53e8ff}.chart-point.pb{stroke:#c8ff3d;stroke-width:5}.chart-value{fill:#f5f7fb;font-size:10px;font-weight:900;text-anchor:middle}.chart-date{fill:#8290a6;font-size:9px;text-anchor:middle}.chart-empty{padding:28px;text-align:center;color:var(--muted);font-size:12px}
    .cloud-status.local i{background:var(--amber);box-shadow:0 0 12px rgba(255,201,74,.45)}.cloud-status{cursor:pointer}
    @media(max-width:600px){.development-panel{padding:15px}.development-kpis{grid-template-columns:1fr 1fr 1fr}.development-kpi{padding:10px 9px}.development-kpi strong{font-size:17px}.development-chart{min-height:200px}.test-card-head-actions{align-items:flex-end;flex-direction:column}.delete-test-btn{min-height:32px}.bronco-mode-row{margin-bottom:6px}}
  `;
  document.head.appendChild(style);

  const quickAdd = document.getElementById("quickAddForm");
  if (quickAdd && !document.getElementById("testModeToggle")) {
    const row = document.createElement("div");
    row.className = "bronco-mode-row";
    row.innerHTML = `
      <div class="bronco-mode-copy"><strong>Testmodus</strong><small>Kjør hele testen uten å lagre tider eller påvirke PB/historikk.</small></div>
      <label class="bronco-switch" aria-label="Testmodus"><input id="testModeToggle" type="checkbox"><span></span></label>`;
    quickAdd.insertAdjacentElement("afterend", row);
    row.querySelector("input").addEventListener("change", event => {
      testMode = event.target.checked;
      document.getElementById("setupPanel")?.classList.toggle("testmode-active", testMode);
      showToast(testMode ? "Testmodus på – ingenting lagres permanent." : "Testmodus av – neste test lagres.");
    });
  }

  const stats = document.getElementById("resultStats");
  if (stats && !document.getElementById("developmentPanel")) {
    const panel = document.createElement("section");
    panel.id = "developmentPanel";
    panel.className = "development-panel glass is-hidden";
    stats.insertAdjacentElement("afterend", panel);
  }
}

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
}

function uniqueNames(names) {
  const seen = new Set();
  return names.filter(name => {
    const key = name.toLocaleLowerCase("nb-NO");
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatTime(ms) {
  if (!Number.isFinite(ms)) return "—";
  const tenths = Math.floor(ms / 100) % 10;
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function formatShortDate(ms) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "2-digit" }).format(new Date(ms));
}

function formatDate(ms) {
  if (!ms) return "Ukjent dato";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(ms));
}

function formatClock(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

function getLevel(ms, status = "finished") {
  if (status !== "finished" || !Number.isFinite(ms)) return { key: "dnf", label: "Ikke fullført" };
  return LEVELS.find(level => ms < level.max) || LEVELS.at(-1);
}

function setCloudStatus(mode, text = "Firestore") {
  if (!els.cloudStatus) return;
  els.cloudStatus.classList.remove("online", "error", "local");
  if (mode) els.cloudStatus.classList.add(mode);
  const label = els.cloudStatus.querySelector("span");
  if (label) label.textContent = text;
}

function markCloudLocal() {
  cloudAvailable = false;
  setCloudStatus("local", "Lokal");
}

function markCloudOnline() {
  cloudAvailable = true;
  setCloudStatus("online", "Lagret");
}

function showToast(message) {
  clearTimeout(toastTimer);
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function localKey() {
  return currentUser ? `bronco-live-${currentUser.uid}` : "bronco-live";
}

function saveLocalLive() {
  if (!liveTest || !currentUser) return;
  localStorage.setItem(localKey(), JSON.stringify(liveTest));
}

function clearLocalLive() {
  if (currentUser) localStorage.removeItem(localKey());
}

function loadLocalLive() {
  if (!currentUser) return null;
  try {
    const raw = localStorage.getItem(localKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.status === "running" ? parsed : null;
  } catch {
    return null;
  }
}

async function loadRoster() {
  setCloudStatus(null, "Laster");
  try {
    const ref = doc(db, "broncoConfig", "team");
    const snap = await getDoc(ref);
    if (snap.exists() && Array.isArray(snap.data().players) && snap.data().players.length) {
      roster = uniqueNames(snap.data().players.map(normalizeName));
    } else {
      roster = [...DEFAULT_PLAYERS];
      await setDoc(ref, { players: roster, updatedAt: serverTimestamp(), updatedBy: currentUser.uid }, { merge: true });
    }
    selectedPlayers = new Set(roster);
    markCloudOnline();
  } catch (error) {
    console.error("Kunne ikke laste spillerliste", error);
    roster = [...DEFAULT_PLAYERS];
    selectedPlayers = new Set(roster);
    markCloudLocal();
    showToast("Skytilkobling feilet. Appen kan fortsatt brukes lokalt.");
  }
  renderRoster();
  renderParticipantSetup();
}

async function saveRoster() {
  renderRoster();
  renderParticipantSetup();
  try {
    await setDoc(doc(db, "broncoConfig", "team"), {
      players: roster,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    }, { merge: true });
    markCloudOnline();
  } catch (error) {
    console.error("Kunne ikke lagre spillerliste", error);
    markCloudLocal();
    showToast("Spillerlisten ble ikke lagret i Firestore.");
  }
}

async function loadTests() {
  try {
    const q = query(collection(db, "broncoTests"), orderBy("startedAtMs", "desc"), limit(100));
    const snap = await getDocs(q);
    tests = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    markCloudOnline();
  } catch (error) {
    console.error("Kunne ikke laste tester", error);
    tests = [];
    markCloudLocal();
    showToast("Kunne ikke hente Bronco-resultatene.");
  }
  renderResults();
}

function enqueueTestSave(snapshot = liveTest) {
  if (!snapshot || !currentUser || snapshot.isTestMode) return Promise.resolve(true);
  const clean = JSON.parse(JSON.stringify(snapshot));
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    setCloudStatus(null, "Lagrer");
    await setDoc(doc(db, "broncoTests", clean.id), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    }, { merge: true });
    markCloudOnline();
    return true;
  }).catch(error => {
    console.error("Firestore-save feilet", error);
    markCloudLocal();
    showToast("Lagring feilet – testen finnes fortsatt lokalt.");
    return false;
  });
  return writeQueue;
}

function renderParticipantSetup() {
  selectedPlayers = new Set([...selectedPlayers].filter(name => roster.includes(name)));
  els.participantGrid.innerHTML = roster.map(name => {
    const selected = selectedPlayers.has(name);
    return `<button class="participant-chip ${selected ? "selected" : ""}" data-player="${esc(name)}"><span>${esc(name)}</span></button>`;
  }).join("");
  els.selectedCount.textContent = selectedPlayers.size;
  els.startBtn.disabled = selectedPlayers.size === 0;
}

function renderRoster() {
  els.rosterList.innerHTML = roster.map(name => `
    <div class="roster-item">
      <b>${esc(name)}</b>
      <button class="remove-btn" data-remove-player="${esc(name)}" aria-label="Fjern ${esc(name)}">×</button>
    </div>`).join("");
}

function addPlayer(name, select = true) {
  const clean = normalizeName(name);
  if (!clean) return false;
  const existing = roster.find(item => item.toLocaleLowerCase("nb-NO") === clean.toLocaleLowerCase("nb-NO"));
  if (existing) {
    showToast(`${clean} finnes allerede.`);
    if (select) selectedPlayers.add(existing);
    renderParticipantSetup();
    return false;
  }
  roster.push(clean);
  if (select) selectedPlayers.add(clean);
  saveRoster();
  return true;
}

function playTone(frequency = 520, duration = 0.11, volume = 0.04) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runCountdown() {
  els.countdownOverlay.classList.remove("is-hidden", "go");
  els.countdownText.textContent = testMode ? "TESTMODUS" : "KLAR";
  for (const number of [3, 2, 1]) {
    els.countdownNumber.textContent = number;
    playTone(430 + number * 35, .09, .035);
    if (navigator.vibrate) navigator.vibrate(35);
    await sleep(1000);
  }
  els.countdownOverlay.classList.add("go");
  els.countdownNumber.textContent = "GO";
  els.countdownText.textContent = "KJØR!";
  playTone(880, .28, .06);
  if (navigator.vibrate) navigator.vibrate([80, 35, 80]);
}

async function startTest() {
  if (liveTest?.status === "running") return;
  const participants = roster.filter(name => selectedPlayers.has(name));
  if (!participants.length) return;
  els.startBtn.disabled = true;
  try {
    await runCountdown();
    const startedAtMs = Date.now();
    liveTest = {
      id: `bronco-${startedAtMs}-${Math.random().toString(36).slice(2, 8)}`,
      type: "bronco-1200",
      distanceM: 1200,
      status: "running",
      isTestMode: testMode,
      startedAtMs,
      endedAtMs: null,
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email || "",
      participants: participants.map(name => ({ name, status: "running", timeMs: null, finishedAtMs: null }))
    };
    finishStack = [];
    saveLocalLive();
    if (!liveTest.isTestMode) enqueueTestSave(liveTest);
    showLivePanel();
    requestWakeLock();
    startClock();
    await sleep(450);
    els.countdownOverlay.classList.add("is-hidden");
    if (liveTest.isTestMode) showToast("TESTMODUS – tider lagres ikke.");
  } finally {
    els.startBtn.disabled = false;
  }
}

function showLivePanel() {
  els.setupPanel.classList.add("is-hidden");
  els.livePanel.classList.remove("is-hidden");
  renderLive();
}

function showSetupPanel() {
  els.livePanel.classList.add("is-hidden");
  els.setupPanel.classList.remove("is-hidden");
  stopClock();
}

function startClock() {
  stopClock();
  const tick = () => {
    if (!liveTest || liveTest.status !== "running") return;
    const elapsed = Math.max(0, Date.now() - liveTest.startedAtMs);
    els.liveClock.textContent = formatTime(elapsed);
    els.clockTrackFill.style.width = `${Math.min(100, (elapsed / 420000) * 100)}%`;
  };
  tick();
  timerHandle = setInterval(tick, 100);
}

function stopClock() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function renderLive() {
  if (!liveTest) return;
  const finished = liveTest.participants.filter(p => p.status === "finished").length;
  const total = liveTest.participants.length;
  const dnf = liveTest.participants.filter(p => p.status === "dnf").length;
  const active = total - finished - dnf;
  els.finishedCount.textContent = finished;
  els.totalCount.textContent = `/ ${total} i mål`;
  els.undoBtn.disabled = finishStack.length === 0;
  els.stopBtn.textContent = active === 0
    ? (liveTest.isTestMode ? "✓ AVSLUTT TESTMODUS" : "✓ FULLFØR & LAGRE")
    : "■ STOPP TEST";
  els.liveHint.textContent = liveTest.isTestMode
    ? "TESTMODUS · Ingenting her lagres permanent."
    : active === 0
      ? "Alle er registrert. Kontroller listen og fullfør testen."
      : "Trykk på spilleren idet han passerer mål.";

  els.finishGrid.innerHTML = liveTest.participants.map(player => {
    const level = getLevel(player.timeMs, player.status);
    if (player.status === "running") {
      return `<button class="finish-btn" data-finish-player="${esc(player.name)}"><b>${esc(player.name)}</b><small>Løper nå</small></button>`;
    }
    return `<button class="finish-btn done level-${level.key}" disabled><b>${esc(player.name)}</b><small>${player.status === "finished" ? formatTime(player.timeMs) : "DNF"}</small></button>`;
  }).join("");
}

function finishPlayer(name) {
  if (!liveTest || liveTest.status !== "running") return;
  const player = liveTest.participants.find(item => item.name === name);
  if (!player || player.status !== "running") return;
  const now = Date.now();
  player.status = "finished";
  player.finishedAtMs = now;
  player.timeMs = Math.max(0, now - liveTest.startedAtMs);
  finishStack.push(name);
  saveLocalLive();
  if (!liveTest.isTestMode) enqueueTestSave(liveTest);
  playTone(640, .08, .025);
  if (navigator.vibrate) navigator.vibrate(28);
  renderLive();
  const remaining = liveTest.participants.filter(item => item.status === "running").length;
  if (remaining === 0) showToast("Alle er i mål – kontroller og fullfør testen.");
}

function undoLastFinish() {
  if (!liveTest || !finishStack.length) return;
  const name = finishStack.pop();
  const player = liveTest.participants.find(item => item.name === name);
  if (!player || player.status !== "finished") return;
  player.status = "running";
  player.timeMs = null;
  player.finishedAtMs = null;
  saveLocalLive();
  if (!liveTest.isTestMode) enqueueTestSave(liveTest);
  renderLive();
  showToast(`${name} er satt tilbake til «løper».`);
}

async function stopTest() {
  if (!liveTest || liveTest.status !== "running") return;
  const remaining = liveTest.participants.filter(player => player.status === "running");
  if (remaining.length) {
    const ok = confirm(`${remaining.length} spiller${remaining.length === 1 ? "" : "e"} har ikke kommet i mål. Stopper du nå blir de registrert som «Ikke fullført».`);
    if (!ok) return;
    remaining.forEach(player => {
      player.status = "dnf";
      player.timeMs = null;
      player.finishedAtMs = null;
    });
  }

  liveTest.status = "completed";
  liveTest.endedAtMs = Date.now();
  saveLocalLive();
  stopClock();
  renderLive();

  if (liveTest.isTestMode) {
    clearLocalLive();
    await releaseWakeLock();
    liveTest = null;
    finishStack = [];
    showSetupPanel();
    showToast("Testmodus avsluttet – ingen tider ble lagret.");
    return;
  }

  const completedSnapshot = JSON.parse(JSON.stringify(liveTest));
  const saved = await enqueueTestSave(completedSnapshot);
  if (!saved) {
    showToast("Kunne ikke bekrefte lagring. Lokal sikkerhetskopi beholdes.");
    return;
  }

  clearLocalLive();
  await releaseWakeLock();
  liveTest = null;
  finishStack = [];
  showSetupPanel();
  await loadTests();
  navigate("results");
  showToast("Testen er lagret.");
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator && liveTest?.status === "running") {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (error) {
    console.warn("Wake Lock ikke tilgjengelig", error);
  }
}

async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch {}
  wakeLock = null;
}

function calculatePBs() {
  const pbs = new Map();
  for (const test of tests) {
    for (const player of test.participants || []) {
      if (player.status !== "finished" || !Number.isFinite(player.timeMs)) continue;
      const key = player.name.toLocaleLowerCase("nb-NO");
      const current = pbs.get(key);
      if (!current || player.timeMs < current.timeMs) pbs.set(key, { timeMs: player.timeMs, name: player.name, testId: test.id });
    }
  }
  return pbs;
}

function filteredTests() {
  const player = els.playerFilter.value;
  if (!player) return tests;
  return tests.filter(test => (test.participants || []).some(item => item.name === player));
}

function renderPlayerFilter() {
  const current = els.playerFilter.value;
  const names = uniqueNames([
    ...roster,
    ...tests.flatMap(test => (test.participants || []).map(item => item.name))
  ]).sort((a,b) => a.localeCompare(b, "nb-NO"));
  els.playerFilter.innerHTML = `<option value="">Alle</option>${names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
  if (names.includes(current)) els.playerFilter.value = current;
}

function getPlayerSeries(playerName) {
  return tests
    .map(test => {
      const player = (test.participants || []).find(item => item.name === playerName);
      if (!player || player.status !== "finished" || !Number.isFinite(player.timeMs)) return null;
      return { testId: test.id, dateMs: test.startedAtMs, timeMs: player.timeMs };
    })
    .filter(Boolean)
    .sort((a,b) => a.dateMs - b.dateMs);
}

function renderDevelopmentChart(playerName) {
  const panel = document.getElementById("developmentPanel");
  if (!panel) return;
  if (!playerName) {
    panel.classList.add("is-hidden");
    panel.innerHTML = "";
    return;
  }

  const series = getPlayerSeries(playerName);
  panel.classList.remove("is-hidden");

  if (!series.length) {
    panel.innerHTML = `<div class="development-head"><div><p class="eyebrow">PLAYER TREND</p><h3>${esc(playerName)}</h3><p>Utviklingsgraf</p></div></div><div class="chart-empty">Ingen fullførte Bronco-tester for ${esc(playerName)} ennå.</div>`;
    return;
  }

  const first = series[0].timeMs;
  const latest = series.at(-1).timeMs;
  const pb = Math.min(...series.map(item => item.timeMs));
  const improvement = first - latest;
  const improvementText = improvement > 0 ? `−${(improvement / 1000).toFixed(1)} s` : improvement < 0 ? `+${(Math.abs(improvement) / 1000).toFixed(1)} s` : "0.0 s";

  const width = 760;
  const height = 270;
  const pad = { left: 54, right: 24, top: 32, bottom: 50 };
  const values = series.map(item => item.timeMs / 1000);
  let minY = Math.min(...values);
  let maxY = Math.max(...values);
  const spread = Math.max(12, maxY - minY);
  minY = Math.max(0, minY - Math.max(6, spread * .25));
  maxY = maxY + Math.max(6, spread * .25);
  if (series.length === 1) { minY = Math.max(0, values[0] - 15); maxY = values[0] + 15; }

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xFor = i => series.length === 1 ? pad.left + plotW / 2 : pad.left + (i / (series.length - 1)) * plotW;
  const yFor = seconds => pad.top + ((maxY - seconds) / (maxY - minY)) * plotH;

  const points = series.map((item, i) => ({
    ...item,
    sec: item.timeMs / 1000,
    x: xFor(i),
    y: yFor(item.timeMs / 1000)
  }));

  const path = points.map((p,i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = series.length > 1 ? `${path} L${points.at(-1).x.toFixed(1)},${(pad.top + plotH).toFixed(1)} L${points[0].x.toFixed(1)},${(pad.top + plotH).toFixed(1)} Z` : "";
  const gridCount = 4;
  const grids = Array.from({length:gridCount + 1}, (_, i) => {
    const sec = maxY - ((maxY - minY) * i / gridCount);
    const y = yFor(sec);
    return `<line class="chart-grid" x1="${pad.left}" y1="${y}" x2="${width-pad.right}" y2="${y}"/><text class="chart-axis-label" x="${pad.left-9}" y="${y+3}" text-anchor="end">${formatTime(sec*1000).replace('.0','')}</text>`;
  }).join("");

  const pointSvg = points.map((p,i) => {
    const isPb = p.timeMs === pb;
    const isLatest = i === points.length - 1;
    const classes = `chart-point${isPb ? " pb" : ""}${isLatest ? " latest" : ""}`;
    return `<g><circle class="${classes}" cx="${p.x}" cy="${p.y}" r="7"/><text class="chart-value" x="${p.x}" y="${Math.max(13,p.y-13)}">${formatTime(p.timeMs)}</text><text class="chart-date" x="${p.x}" y="${height-18}">${formatShortDate(p.dateMs)}</text></g>`;
  }).join("");

  panel.innerHTML = `
    <div class="development-head">
      <div><p class="eyebrow">PLAYER TREND</p><h3>${esc(playerName)}</h3><p>${series.length} fullførte test${series.length === 1 ? "" : "er"} · lavere tid er bedre</p></div>
    </div>
    <div class="development-kpis">
      <div class="development-kpi"><span>Siste</span><strong>${formatTime(latest)}</strong></div>
      <div class="development-kpi good"><span>PB</span><strong>${formatTime(pb)}</strong></div>
      <div class="development-kpi ${improvement > 0 ? "good" : ""}"><span>Fra første</span><strong>${improvementText}</strong></div>
    </div>
    <div class="chart-shell">
      <svg class="development-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Utviklingsgraf for ${esc(playerName)}">
        <defs><linearGradient id="broncoArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#53e8ff" stop-opacity=".2"/><stop offset="1" stop-color="#53e8ff" stop-opacity="0"/></linearGradient></defs>
        ${grids}
        ${areaPath ? `<path class="chart-area" d="${areaPath}"/>` : ""}
        ${series.length > 1 ? `<path class="chart-line" d="${path}"/>` : ""}
        ${pointSvg}
      </svg>
    </div>`;
}

function renderResults() {
  renderPlayerFilter();
  const pbs = calculatePBs();
  const viewTests = filteredTests();
  const selected = els.playerFilter.value;
  const allFinished = viewTests.flatMap(test => (test.participants || []).filter(p => p.status === "finished" && (!selected || p.name === selected)));
  const best = allFinished.length ? Math.min(...allFinished.map(p => p.timeMs)) : null;
  const average = allFinished.length ? Math.round(allFinished.reduce((sum,p) => sum + p.timeMs, 0) / allFinished.length) : null;

  els.resultStats.innerHTML = `
    <div class="stat-card"><span>${selected ? "Personlig rekord" : "Beste registrert"}</span><strong>${best ? formatTime(best) : "—"}</strong><small>${selected ? esc(selected) : "Alle tester"}</small></div>
    <div class="stat-card"><span>${selected ? "Tester" : "Testøkter"}</span><strong>${viewTests.length}</strong><small>lagret</small></div>
    <div class="stat-card"><span>Snitt</span><strong>${average ? formatTime(average) : "—"}</strong><small>${allFinished.length} fullføringer</small></div>`;

  renderDevelopmentChart(selected);

  if (!viewTests.length) {
    els.historyList.innerHTML = `<div class="empty-state"><strong>Ingen tester ennå</strong>Start en Bronco-test, så bygges historikken automatisk.</div>`;
    return;
  }

  els.historyList.innerHTML = viewTests.map(test => {
    let rows = [...(test.participants || [])];
    if (selected) rows = rows.filter(item => item.name === selected);
    rows.sort((a,b) => {
      if (a.status === "finished" && b.status !== "finished") return -1;
      if (a.status !== "finished" && b.status === "finished") return 1;
      return (a.timeMs || Infinity) - (b.timeMs || Infinity);
    });
    const finished = rows.filter(p => p.status === "finished");
    const bestHere = finished.length ? Math.min(...finished.map(p => p.timeMs)) : null;
    const avgHere = finished.length ? Math.round(finished.reduce((sum,p) => sum + p.timeMs, 0) / finished.length) : null;

    const rowHtml = rows.map(player => {
      const level = getLevel(player.timeMs, player.status);
      const pbEntry = pbs.get(player.name.toLocaleLowerCase("nb-NO"));
      const isPB = player.status === "finished" && pbEntry && pbEntry.timeMs === player.timeMs;
      const delta = player.status === "finished" && pbEntry ? player.timeMs - pbEntry.timeMs : null;
      const meta = player.status === "dnf" ? "Ikke fullført" : isPB ? "★ Personlig rekord" : delta > 0 ? `+${(delta / 1000).toFixed(1)} s fra PB` : "Fullført";
      return `<div class="result-row level-${level.key}">
        <div><div class="name">${esc(player.name)}</div><div class="meta">${meta}</div></div>
        <div class="result-time">${player.status === "finished" ? formatTime(player.timeMs) : "DNF"}</div>
        <div class="level-badge">${esc(level.label)}</div>
      </div>`;
    }).join("");

    return `<article class="test-card" data-test-id="${esc(test.id)}">
      <header class="test-card-head">
        <div><h3>${formatDate(test.startedAtMs)}</h3><p>Start ${formatClock(test.startedAtMs)} · ${test.participants?.length || 0} deltakere</p></div>
        <div class="test-card-head-actions">
          <div class="test-card-summary"><b>${bestHere ? formatTime(bestHere) : "DNF"}</b><span>${avgHere ? `snitt ${formatTime(avgHere)}` : "ingen fullførte"}</span></div>
          <button class="delete-test-btn" data-delete-test="${esc(test.id)}">SLETT TEST</button>
        </div>
      </header>
      <div>${rowHtml}</div>
    </article>`;
  }).join("");
}

async function deleteTest(testId) {
  const test = tests.find(item => item.id === testId);
  if (!test) return;
  const label = formatDate(test.startedAtMs);
  if (!confirm(`Slette Bronco-testen fra ${label}? Dette kan ikke angres.`)) return;
  const button = document.querySelector(`[data-delete-test="${CSS.escape(testId)}"]`);
  if (button) { button.disabled = true; button.textContent = "SLETTER…"; }
  try {
    await deleteDoc(doc(db, "broncoTests", testId));
    tests = tests.filter(item => item.id !== testId);
    markCloudOnline();
    renderResults();
    showToast("Testen er slettet.");
  } catch (error) {
    console.error("Kunne ikke slette test", error);
    markCloudLocal();
    if (button) { button.disabled = false; button.textContent = "SLETT TEST"; }
    showToast("Kunne ikke slette testen fra Firestore.");
  }
}

function navigate(viewName) {
  if (liveTest?.status === "running" && viewName !== "test") {
    showToast("Testen pågår – avslutt den før du går videre.");
    return;
  }
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `view-${viewName}`));
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.nav === viewName));
  if (viewName === "results") renderResults();
  if (viewName === "players") renderRoster();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function bootForUser(user) {
  currentUser = user;
  els.authGate.classList.add("is-hidden");
  els.appRoot.classList.remove("is-hidden");
  await loadRoster();
  await loadTests();
  const restored = loadLocalLive();
  if (restored) {
    liveTest = restored;
    testMode = !!liveTest.isTestMode;
    const toggle = document.getElementById("testModeToggle");
    if (toggle) toggle.checked = testMode;
    document.getElementById("setupPanel")?.classList.toggle("testmode-active", testMode);
    finishStack = liveTest.participants.filter(p => p.status === "finished").sort((a,b) => (a.finishedAtMs || 0) - (b.finishedAtMs || 0)).map(p => p.name);
    showLivePanel();
    startClock();
    requestWakeLock();
    showToast("Aktiv test ble gjenopprettet.");
  } else {
    showSetupPanel();
  }
}

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.loginError.textContent = "";
  const button = els.loginForm.querySelector("button");
  button.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, els.loginEmail.value.trim(), els.loginPassword.value);
  } catch (error) {
    console.error(error);
    els.loginError.textContent = "Innlogging feilet. Kontroller e-post og passord.";
  } finally {
    button.disabled = false;
  }
});

els.logoutBtn.addEventListener("click", async () => {
  if (liveTest?.status === "running") {
    showToast("Avslutt testen før du logger ut.");
    return;
  }
  await signOut(auth);
});

els.cloudStatus?.addEventListener("click", () => {
  showToast(cloudAvailable ? "Firestore er tilkoblet. Resultater lagres i skyen." : "Lokal modus: appen virker, men Firestore-lagring er ikke bekreftet.");
});

els.participantGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-player]");
  if (!button) return;
  const name = button.dataset.player;
  selectedPlayers.has(name) ? selectedPlayers.delete(name) : selectedPlayers.add(name);
  renderParticipantSetup();
});

els.selectAllBtn.addEventListener("click", () => { selectedPlayers = new Set(roster); renderParticipantSetup(); });
els.selectNoneBtn.addEventListener("click", () => { selectedPlayers.clear(); renderParticipantSetup(); });

els.quickAddForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = normalizeName(els.quickAddInput.value);
  if (addPlayer(name, true)) {
    showToast(`${name} lagt til.`);
    els.quickAddInput.value = "";
  }
});

els.rosterAddForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = normalizeName(els.rosterAddInput.value);
  if (addPlayer(name, true)) {
    showToast(`${name} lagt til.`);
    els.rosterAddInput.value = "";
  }
});

els.rosterList.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-player]");
  if (!button) return;
  const name = button.dataset.removePlayer;
  if (!confirm(`Fjerne ${name} fra spillerlisten? Historiske resultater blir ikke slettet.`)) return;
  roster = roster.filter(item => item !== name);
  selectedPlayers.delete(name);
  saveRoster();
});

els.resetRosterBtn.addEventListener("click", () => {
  if (!confirm("Tilbakestille spillerlisten til standardtroppen for G14? Ekstra navn fjernes fra startlisten, men historiske resultater beholdes.")) return;
  roster = [...DEFAULT_PLAYERS];
  selectedPlayers = new Set(roster);
  saveRoster();
  showToast("Standardtroppen er gjenopprettet.");
});

els.startBtn.addEventListener("click", startTest);
els.finishGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-finish-player]");
  if (button) finishPlayer(button.dataset.finishPlayer);
});
els.undoBtn.addEventListener("click", undoLastFinish);
els.stopBtn.addEventListener("click", stopTest);
els.playerFilter.addEventListener("change", renderResults);
els.historyList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-test]");
  if (button) deleteTest(button.dataset.deleteTest);
});

document.querySelectorAll("[data-nav]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.nav)));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && liveTest?.status === "running" && !wakeLock) requestWakeLock();
});

window.addEventListener("beforeunload", event => {
  if (liveTest?.status === "running") {
    event.preventDefault();
    event.returnValue = "";
  }
});

onAuthStateChanged(auth, user => {
  if (user) {
    bootForUser(user);
  } else {
    currentUser = null;
    liveTest = null;
    finishStack = [];
    stopClock();
    releaseWakeLock();
    els.appRoot.classList.add("is-hidden");
    els.authGate.classList.remove("is-hidden");
    setCloudStatus(null, "Firestore");
  }
});
