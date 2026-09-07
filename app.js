import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
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
  els.cloudStatus.classList.remove("online", "error");
  if (mode) els.cloudStatus.classList.add(mode);
  const label = els.cloudStatus.querySelector("span");
  if (label) label.textContent = text;
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2400);
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
    setCloudStatus("online");
  } catch (error) {
    console.error("Kunne ikke laste spillerliste", error);
    roster = [...DEFAULT_PLAYERS];
    selectedPlayers = new Set(roster);
    setCloudStatus("error", "Lokal liste");
    showToast("Kunne ikke lese spillerlisten fra Firestore.");
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
    setCloudStatus("online");
  } catch (error) {
    console.error("Kunne ikke lagre spillerliste", error);
    setCloudStatus("error", "Ikke lagret");
    showToast("Spillerlisten ble ikke lagret i Firestore.");
  }
}

async function loadTests() {
  try {
    const q = query(collection(db, "broncoTests"), orderBy("startedAtMs", "desc"), limit(60));
    const snap = await getDocs(q);
    tests = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    setCloudStatus("online");
  } catch (error) {
    console.error("Kunne ikke laste tester", error);
    tests = [];
    setCloudStatus("error", "Lesefeil");
    showToast("Kunne ikke hente Bronco-historikken.");
  }
  renderResults();
}

function enqueueTestSave(snapshot = liveTest) {
  if (!snapshot || !currentUser) return Promise.resolve();
  const clean = JSON.parse(JSON.stringify(snapshot));
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    setCloudStatus(null, "Lagrer");
    await setDoc(doc(db, "broncoTests", clean.id), {
      ...clean,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid
    }, { merge: true });
    setCloudStatus("online");
  }).catch(error => {
    console.error("Firestore-save feilet", error);
    setCloudStatus("error", "Ikke lagret");
    showToast("Lagring feilet – testen finnes fortsatt lokalt.");
    throw error;
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
  if (roster.some(item => item.toLocaleLowerCase("nb-NO") === clean.toLocaleLowerCase("nb-NO"))) {
    showToast(`${clean} finnes allerede.`);
    if (select) selectedPlayers.add(roster.find(item => item.toLocaleLowerCase("nb-NO") === clean.toLocaleLowerCase("nb-NO")));
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
  els.countdownText.textContent = "KLAR";
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
      startedAtMs,
      endedAtMs: null,
      createdBy: currentUser.uid,
      createdByEmail: currentUser.email || "",
      participants: participants.map(name => ({ name, status: "running", timeMs: null, finishedAtMs: null }))
    };
    finishStack = [];
    saveLocalLive();
    enqueueTestSave(liveTest);
    showLivePanel();
    requestWakeLock();
    startClock();
    await sleep(450);
    els.countdownOverlay.classList.add("is-hidden");
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
  const active = total - finished - liveTest.participants.filter(p => p.status === "dnf").length;
  els.finishedCount.textContent = finished;
  els.totalCount.textContent = `/ ${total} i mål`;
  els.undoBtn.disabled = finishStack.length === 0;
  els.stopBtn.textContent = active === 0 ? "✓ FULLFØR & LAGRE" : "■ STOPP TEST";
  els.liveHint.textContent = active === 0 ? "Alle er registrert. Kontroller listen og fullfør testen." : "Trykk på spilleren idet han passerer mål.";

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
  enqueueTestSave(liveTest);
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
  enqueueTestSave(liveTest);
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
  const completedSnapshot = JSON.parse(JSON.stringify(liveTest));
  await enqueueTestSave(completedSnapshot).catch(() => {});
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
  const names = uniqueNames(tests.flatMap(test => (test.participants || []).map(item => item.name))).sort((a,b) => a.localeCompare(b, "nb-NO"));
  els.playerFilter.innerHTML = `<option value="">Alle</option>${names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("")}`;
  if (names.includes(current)) els.playerFilter.value = current;
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
      const pb = pbs.get(player.name.toLocaleLowerCase("nb-NO"));
      const isPB = player.status === "finished" && pb && pb.timeMs === player.timeMs;
      const delta = player.status === "finished" && pb ? player.timeMs - pb.timeMs : null;
      const meta = player.status === "dnf" ? "Ikke fullført" : isPB ? "★ Personlig rekord" : delta > 0 ? `+${(delta / 1000).toFixed(1)} s fra PB` : "Fullført";
      return `<div class="result-row level-${level.key}">
        <div><div class="name">${esc(player.name)}</div><div class="meta">${meta}</div></div>
        <div class="result-time">${player.status === "finished" ? formatTime(player.timeMs) : "DNF"}</div>
        <div class="level-badge">${esc(level.label)}</div>
      </div>`;
    }).join("");

    return `<article class="test-card">
      <header class="test-card-head">
        <div><h3>${formatDate(test.startedAtMs)}</h3><p>Start ${formatClock(test.startedAtMs)} · ${test.participants?.length || 0} deltakere</p></div>
        <div class="test-card-summary"><b>${bestHere ? formatTime(bestHere) : "DNF"}</b><span>${avgHere ? `snitt ${formatTime(avgHere)}` : "ingen fullførte"}</span></div>
      </header>
      <div>${rowHtml}</div>
    </article>`;
  }).join("");
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
  if (addPlayer(els.quickAddInput.value, true)) {
    showToast(`${normalizeName(els.quickAddInput.value)} lagt til.`);
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
    setCloudStatus(null);
  }
});
