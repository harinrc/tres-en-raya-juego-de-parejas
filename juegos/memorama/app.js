const STORAGE_KEYS = {
  playerName: "memorama-player-name",
  theme: "tresenraya-theme"
};

const defaultDecks = {
  facil: ["🍉", "🍋", "🍇", "🍒", "🍊", "🫐", "🍓", "🍍"],
  normal: ["🍉", "🍋", "🍇", "🍒", "🍊", "🫐", "🍓", "🍍", "🥝", "🍏"],
  dificil: ["🍉", "🍋", "🍇", "🍒", "🍊", "🫐", "🍓", "🍍", "🥝", "🍏", "🍑", "🍎"]
};

const themeMeta = document.getElementById("themeColorMeta");
const jugadorLabel = document.getElementById("jugadorLabel");
const parejasLabel = document.getElementById("parejasLabel");
const intentosLabel = document.getElementById("intentosLabel");
const tiempoLabel = document.getElementById("tiempoLabel");
const mensajeEstado = document.getElementById("mensajeEstado");
const tablero = document.getElementById("tablero");
const nombreInput = document.getElementById("nombreInput");
const dificultadSelect = document.getElementById("dificultadSelect");
const reiniciarBtn = document.getElementById("reiniciarBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const logList = document.getElementById("logList");

let deck = [];
let selectedCards = [];
let matchedPairs = 0;
let attempts = 0;
let timer = 0;
let timerId = null;
let isBusy = false;
let hasStarted = false;
let deferredInstallPrompt = null;

function getStoredTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.theme);
  if (theme === "light" || theme === "dark") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const isDark = theme === "dark";
  themeToggleBtn.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  if (themeMeta) {
    themeMeta.setAttribute("content", isDark ? "#120f1d" : "#2bb3a3");
  }
}

function setPlayerName() {
  const nombre = (nombreInput.value || "Invitado").trim() || "Invitado";
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  jugadorLabel.textContent = nombre;
}

function addLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  logList.prepend(item);
  while (logList.children.length > 5) {
    logList.removeChild(logList.lastChild);
  }
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateStatus() {
  const totalPairs = deck.length / 2;
  parejasLabel.textContent = `${matchedPairs}/${totalPairs}`;
  intentosLabel.textContent = String(attempts);
  tiempoLabel.textContent = formatTime(timer);
}

function startTimer() {
  if (timerId) return;
  timerId = window.setInterval(() => {
    timer += 1;
    updateStatus();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function buildDeck(level) {
  const symbols = [...defaultDecks[level]];
  const shuffled = [...symbols, ...symbols]
    .map((emoji, index) => ({ id: `${emoji}-${index}-${Math.random().toString(16).slice(2)}`, value: emoji }))
    .sort(() => Math.random() - 0.5);
  return shuffled;
}

function createCardButton(card, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card";
  button.dataset.index = String(index);
  button.dataset.value = card.value;
  button.dataset.id = card.id;
  button.setAttribute("aria-label", `Carta ${index + 1}`);

  const back = document.createElement("span");
  back.className = "face back";
  back.textContent = "?";

  const front = document.createElement("span");
  front.className = "face front";
  front.textContent = card.value;

  button.append(back, front);
  button.addEventListener("click", () => handleCardClick(button, card));
  return button;
}

function renderBoard() {
  tablero.innerHTML = "";
  deck.forEach((card, index) => {
    const button = createCardButton(card, index);
    tablero.appendChild(button);
  });
}

function revealCard(button) {
  button.classList.add("revealed");
  button.disabled = true;
}

function hideCard(button) {
  button.classList.remove("revealed");
  button.disabled = false;
}

function markMatched(button) {
  button.classList.add("matched");
  button.disabled = true;
}

function resetSelection() {
  selectedCards = [];
  isBusy = false;
}

function revealAllMatched() {
  const cards = [...document.querySelectorAll(".card")];
  cards.forEach((card) => {
    if (card.classList.contains("matched")) {
      card.disabled = true;
    }
  });
}

function evaluateTurn() {
  const [first, second] = selectedCards;
  const firstValue = first.dataset.value;
  const secondValue = second.dataset.value;

  if (firstValue === secondValue) {
    matchedPairs += 1;
    markMatched(first);
    markMatched(second);
    addLog(`¡Pareja encontrada: ${firstValue}!`);
    mensajeEstado.textContent = `Perfecto, ${firstValue} es una pareja.`;
    if (matchedPairs === deck.length / 2) {
      stopTimer();
      mensajeEstado.textContent = `¡Completaste el tablero en ${attempts} intentos y ${formatTime(timer)}!`;
      addLog("Partida completada.");
    }
    resetSelection();
    updateStatus();
    revealAllMatched();
    return;
  }

  mensajeEstado.textContent = "No coincide. Sigue intentando.";
  addLog("No hay coincidencia.");
  window.setTimeout(() => {
    hideCard(first);
    hideCard(second);
    resetSelection();
  }, 700);
}

function handleCardClick(button, card) {
  if (isBusy || button.classList.contains("revealed") || button.classList.contains("matched")) return;

  if (!hasStarted) {
    hasStarted = true;
    startTimer();
  }

  revealCard(button);
  selectedCards.push(button);

  if (selectedCards.length === 2) {
    attempts += 1;
    isBusy = true;
    updateStatus();
    window.setTimeout(() => {
      evaluateTurn();
    }, 420);
  }
}

function resetGame() {
  const level = dificultadSelect.value;
  deck = buildDeck(level);
  selectedCards = [];
  matchedPairs = 0;
  attempts = 0;
  timer = 0;
  hasStarted = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  mensajeEstado.textContent = "Busca las parejas y gana la partida.";
  addLog(`Nueva partida · nivel ${level}.`);
  renderBoard();
  updateStatus();
}

function inicializarTema() {
  const savedTheme = getStoredTheme();
  applyTheme(savedTheme);
}

function inicializarInstalacion() {
  const instalarBtn = document.getElementById("instalarBtn");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    instalarBtn.hidden = false;
  });

  instalarBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") {
      instalarBtn.hidden = true;
    }
    deferredInstallPrompt = null;
  });
}

nombreInput.value = localStorage.getItem(STORAGE_KEYS.playerName) || "";
setPlayerName();
inicializarTema();
inicializarInstalacion();

dificultadSelect.addEventListener("change", resetGame);
reiniciarBtn.addEventListener("click", resetGame);
nameInputHandler();

function nameInputHandler() {
  nombreInput.addEventListener("input", () => {
    setPlayerName();
  });
}

if (nombreInput.value) setPlayerName();
resetGame();
themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});
