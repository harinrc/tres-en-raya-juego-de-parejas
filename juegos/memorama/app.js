const firebaseConfig = {
  apiKey: "AIzaSyAf65_YB-vDHDeVf6dUP6vMKLp_ctSy83A",
  authDomain: "x0-para-ana-y-harin.firebaseapp.com",
  databaseURL: "https://x0-para-ana-y-harin-default-rtdb.firebaseio.com",
  projectId: "x0-para-ana-y-harin",
  storageBucket: "x0-para-ana-y-harin.firebasestorage.app",
  messagingSenderId: "525006791707",
  appId: "1:525006791707:web:1e07c6ebedc298c96a04be"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

const STORAGE_KEYS = {
  playerName: "memorama-player-name",
  theme: "tresenraya-theme",
  gameCode: "memorama-game-code"
};

const THEMES = {
  emoji: ["🍉", "🍋", "🍇", "🍒", "🍊", "🫐", "🍓", "🍍", "🥝", "🍏", "🍑", "🍎"],
  frutas: ["🍇", "🍊", "🍋", "🍉", "🍓", "🍒", "🥭", "🍍", "🍏", "🍐", "🍑", "🍊"],
  animales: ["🐶", "🐱", "🦊", "🐼", "🐸", "🐵", "🐼", "🐧", "🐰", "🐻", "🐯", "🦁"],
  paisajes: ["🌄", "🌊", "🌵", "🌻", "🌲", "🌙", "🌞", "⛰️", "🌧️", "🌈", "🌿", "🌸"]
};

const dom = {
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeColorMeta: document.getElementById("themeColorMeta"),
  nombreInput: document.getElementById("nombreInput"),
  codigoInput: document.getElementById("codigoInput"),
  modeSelect: document.getElementById("modeSelect"),
  dificultadSelect: document.getElementById("dificultadSelect"),
  deckThemeSelect: document.getElementById("deckThemeSelect"),
  uploadDeckBtn: document.getElementById("uploadDeckBtn"),
  uploadDeckInput: document.getElementById("uploadDeckInput"),
  crearJuegoBtn: document.getElementById("crearJuegoBtn"),
  unirseBtn: document.getElementById("unirseBtn"),
  tablero: document.getElementById("tablero"),
  jugadorLabel: document.getElementById("jugadorLabel"),
  parejasLabel: document.getElementById("parejasLabel"),
  intentosLabel: document.getElementById("intentosLabel"),
  tiempoLabel: document.getElementById("tiempoLabel"),
  mensajeEstado: document.getElementById("mensajeEstado"),
  sessionBanner: document.getElementById("sessionBanner"),
  codigoJuego: document.getElementById("codigoJuego"),
  estadoJuego: document.getElementById("estadoJuego"),
  chatBox: document.getElementById("chatBox"),
  mensajeInput: document.getElementById("mensajeInput"),
  enviarBtn: document.getElementById("enviarBtn"),
  corazonBtn: document.getElementById("corazonBtn"),
  adjuntarBtn: document.getElementById("adjuntarBtn"),
  galeriaInput: document.getElementById("galeriaInput"),
  camaraInput: document.getElementById("camaraInput"),
  typingIndicator: document.getElementById("typingIndicator"),
  replyPreview: document.getElementById("replyPreview"),
  replyPreviewAuthor: document.getElementById("replyPreviewAuthor"),
  replyPreviewText: document.getElementById("replyPreviewText"),
  cancelReplyBtn: document.getElementById("cancelReplyBtn"),
  reactionPopup: document.getElementById("reactionPopup"),
  instalarBtn: document.getElementById("instalarBtn")
};

const soloState = {
  board: [],
  selected: [],
  matched: 0,
  attempts: 0,
  timer: 0,
  id: null,
  started: false,
  busy: false,
  timerId: null,
  deckTheme: "emoji"
};

let clientId = null;
let playerSlot = null;
let roomCode = null;
let roomRef = null;
let currentRoom = null;
let currentReply = null;
let activeReactionMessageId = null;
let typingTimer = null;
let deferredInstallPrompt = null;
let customDeck = [];

function getOrCreateClientId() {
  const stored = localStorage.getItem("memorama-client-id");
  if (stored) return stored;
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem("memorama-client-id", newId);
  return newId;
}

clientId = getOrCreateClientId();

dom.nombreInput.value = localStorage.getItem(STORAGE_KEYS.playerName) || "";
dom.codigoInput.value = localStorage.getItem(STORAGE_KEYS.gameCode) || "";

dom.modeSelect.value = localStorage.getItem("memorama-mode") || "solo";

dom.deckThemeSelect.value = "emoji";

function setPlayerName() {
  const nombre = (dom.nombreInput.value || "Invitado").trim() || "Invitado";
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  dom.jugadorLabel.textContent = nombre;
}

function setSessionBanner(texto) {
  dom.sessionBanner.textContent = texto;
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getStoredTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const dark = theme === "dark";
  dom.themeToggleBtn.textContent = dark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  dom.themeColorMeta.setAttribute("content", dark ? "#120f1d" : "#2bb3a3");
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getDeckValues(theme, customList = []) {
  if (customList.length > 0) {
    return customList.map((item) => ({ value: item, type: "image" }));
  }

  let source = THEMES[theme] || THEMES.emoji;
  const base = source.slice();
  return base.map((value) => ({ value, type: "emoji" }));
}

function buildDeck(theme, level = "normal", customList = []) {
  let values = getDeckValues(theme, customList);
  const pairsMap = { facil: 8, normal: 10, dificil: 12 };
  const totalPairs = pairsMap[level] || 10;

  const selected = values.slice(0, Math.max(1, totalPairs));
  const combined = [...selected, ...selected].map((item, index) => ({
    id: `${item.type}-${item.value}-${index}-${Math.random().toString(16).slice(2)}`,
    value: item.value,
    type: item.type,
    visible: false,
    matched: false
  }));

  return shuffle(combined);
}

function renderSoloBoard() {
  const cards = soloState.board;
  dom.tablero.innerHTML = "";

  cards.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card" + (card.visible || card.matched ? " revealed" : "") + (card.matched ? " matched" : "");
    btn.disabled = Boolean(card.visible || card.matched);
    btn.setAttribute("aria-label", `Carta ${index + 1}`);

    const inner = document.createElement("div");
    inner.className = "card-inner";

    if (card.visible || card.matched) {
      if (card.type === "image") {
        const img = document.createElement("img");
        img.src = card.value;
        img.alt = "Carta del juego";
        img.className = "card-image";
        inner.appendChild(img);
      } else {
        const emoji = document.createElement("span");
        emoji.className = "card-emoji";
        emoji.textContent = card.value;
        inner.appendChild(emoji);
      }
    } else {
      const back = document.createElement("span");
      back.className = "card-back";
      back.textContent = "?";
      inner.appendChild(back);
    }

    btn.appendChild(inner);
    btn.addEventListener("click", () => handleSoloTurn(index));
    dom.tablero.appendChild(btn);
  });
}

function updateStats() {
  const totalPairs = soloState.board.length / 2;
  dom.parejasLabel.textContent = `${soloState.matched}/${totalPairs || 0}`;
  dom.intentosLabel.textContent = String(soloState.attempts);
  dom.tiempoLabel.textContent = formatTime(soloState.timer);
  dom.estadoJuego.textContent = dom.modeSelect.value === "solo" ? "Modo solo" : "Modo multijugador";
}

function startSoloTimer() {
  if (soloState.timerId) return;
  soloState.timerId = window.setInterval(() => {
    soloState.timer += 1;
    updateStats();
  }, 1000);
}

function stopSoloTimer() {
  if (soloState.timerId) {
    clearInterval(soloState.timerId);
    soloState.timerId = null;
  }
}

function resetSoloGame() {
  const level = dom.dificultadSelect.value;
  soloState.board = buildDeck(dom.deckThemeSelect.value, level, customDeck);
  soloState.selected = [];
  soloState.matched = 0;
  soloState.attempts = 0;
  soloState.timer = 0;
  soloState.started = false;
  soloState.busy = false;
  stopSoloTimer();
  dom.mensajeEstado.textContent = "Busca las parejas y gana la partida.";
  setSessionBanner("Modo solo activo.");
  renderSoloBoard();
  updateStats();
}

function handleSoloTurn(index) {
  if (soloState.busy) return;
  const card = soloState.board[index];
  if (!card || card.visible || card.matched || soloState.selected.includes(index)) return;

  if (!soloState.started) {
    soloState.started = true;
    startSoloTimer();
  }

  card.visible = true;
  soloState.selected.push(index);
  renderSoloBoard();

  if (soloState.selected.length !== 2) return;

  soloState.attempts += 1;
  const [firstIndex, secondIndex] = soloState.selected;
  const first = soloState.board[firstIndex];
  const second = soloState.board[secondIndex];
  soloState.busy = true;
  updateStats();

  if (first.value === second.value) {
    first.matched = true;
    second.matched = true;
    soloState.matched += 1;
    dom.mensajeEstado.textContent = `¡Genial! Encontraste una pareja.`;
    setSessionBanner("Pareja acertada.");
    soloState.selected = [];
    soloState.busy = false;
    renderSoloBoard();
    updateStats();

    if (soloState.matched >= (soloState.board.length / 2)) {
      stopSoloTimer();
      dom.mensajeEstado.textContent = `¡Completaste el tablero en ${soloState.attempts} intentos y ${formatTime(soloState.timer)}!`;
      setSessionBanner("Partida terminada.");
    }
    return;
  }

  dom.mensajeEstado.textContent = "No coincide. Intenta otra vez.";
  setSessionBanner("Pareja fallida.");

  window.setTimeout(() => {
    first.visible = false;
    second.visible = false;
    soloState.selected = [];
    soloState.busy = false;
    renderSoloBoard();
  }, 700);
}

function generarCodigoSala() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const buffer = new Uint32Array(8);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (value) => alphabet[value % alphabet.length]).join("");
}

function openReactionPopup(messageId, event) {
  activeReactionMessageId = messageId;
  const popup = dom.reactionPopup;
  popup.classList.add("visible");
  const x = event.touches?.[0]?.clientX || event.clientX || 100;
  const y = event.touches?.[0]?.clientY || event.clientY || 120;
  const width = popup.offsetWidth || 220;
  const height = popup.offsetHeight || 52;
  popup.style.left = `${Math.min(Math.max(x - width / 2, 8), window.innerWidth - width - 8)}px`;
  popup.style.top = `${Math.min(Math.max(y - height - 12, 8), window.innerHeight - height - 8)}px`;
}

function addReaction(emoji) {
  if (!activeReactionMessageId || !roomRef || !playerSlot) return;
  roomRef.child(`mensajes/${activeReactionMessageId}/reactions/${playerSlot}`).set(emoji);
  dom.reactionPopup.classList.remove("visible");
  activeReactionMessageId = null;
}

function cancelReply() {
  currentReply = null;
  dom.replyPreview.hidden = true;
  dom.replyPreviewAuthor.textContent = "";
  dom.replyPreviewText.textContent = "";
}

function clearChat() {
  dom.chatBox.innerHTML = "";
  dom.typingIndicator.textContent = "";
  cancelReply();
}

function renderMessage(msg, id) {
  if (!msg) return;
  const wrapper = document.createElement("div");
  const isMine = msg.autor === playerSlot || msg.autor === clientId;
  wrapper.className = "message " + (isMine ? "mine" : "other");

  if (msg.repliedTo) {
    const reply = document.createElement("div");
    reply.className = "reply-preview";
    reply.style.display = "block";
    reply.innerHTML = `<div class="reply-author">${msg.repliedTo.autorNombre || "Respuesta"}</div><div class="reply-text">${msg.repliedTo.texto || ""}</div>`;
    wrapper.appendChild(reply);
  }

  if (msg.tipo === "imagen" && msg.imagenUrl) {
    const img = document.createElement("img");
    img.src = msg.imagenUrl;
    img.alt = "Foto enviada";
    wrapper.appendChild(img);
  } else if (msg.texto) {
    const text = document.createElement("span");
    text.textContent = msg.texto;
    wrapper.appendChild(text);
  }

  if (msg.reactions) {
    const reactions = Object.values(msg.reactions);
    if (reactions.length) {
      const pill = document.createElement("div");
      pill.className = "reactions";
      pill.textContent = reactions.join(" ");
      wrapper.appendChild(pill);
    }
  }

  wrapper.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openReactionPopup(id, event);
  });
  wrapper.addEventListener("touchstart", (event) => {
    if (event.touches && event.touches.length > 0) {
      const timeout = window.setTimeout(() => openReactionPopup(id, event.touches[0]), 400);
      event.target.addEventListener("touchend", () => clearTimeout(timeout), { once: true });
    }
  }, { passive: true });

  dom.chatBox.appendChild(wrapper);
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function escucharMensajes() {
  if (!roomRef) return;
  roomRef.child("mensajes").off();
  roomRef.child("mensajes").on("child_added", (snap) => {
    renderMessage(snap.val(), snap.key);
  });
}

function registrarPresencia(slot) {
  if (!roomRef || !slot) return;
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    if (!snap.val()) return;
    const playerRef = roomRef.child(`jugadores/${slot}`);
    playerRef.update({
      id: clientId,
      nombre: dom.nombreInput.value.trim() || "Invitado",
      conectado: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    playerRef.onDisconnect().update({ conectado: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
  });
}

function levantarFoto() {
  const usarCamara = window.confirm("Aceptar = cámara, Cancelar = galería");
  if (usarCamara) dom.camaraInput.click();
  else dom.galeriaInput.click();
}

function uploadImage(file) {
  if (!file || !roomRef) {
    setSessionBanner("Primero crea o entra a una sala.");
    return;
  }

  const ref = storage.ref(`memorama/${Date.now()}-${file.name}`);
  const upload = ref.put(file);
  upload.on("state_changed", (snapshot) => {
    const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
    setSessionBanner(`Subiendo foto: ${percent}%`);
  }, () => {
    setSessionBanner("No se pudo subir la foto.");
  }, () => {
    upload.snapshot.ref.getDownloadURL().then((url) => {
      roomRef.child("mensajes").push({
        autor: playerSlot,
        tipo: "imagen",
        imagenUrl: url,
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      setSessionBanner("Foto enviada.");
    });
  });
}

function handleReplyClick(id, msg) {
  currentReply = { id, autorNombre: msg.autorNombre || "Alguien", texto: msg.texto || "" };
  dom.replyPreviewAuthor.textContent = `Respondiendo a ${currentReply.autorNombre}`;
  dom.replyPreviewText.textContent = currentReply.texto;
  dom.replyPreview.hidden = false;
  dom.mensajeInput.focus();
}

function sendMessage() {
  const texto = dom.mensajeInput.value.trim();
  if (!texto && !roomRef) return;
  if (!roomRef || !playerSlot) {
    setSessionBanner("Crea o entra a una sala antes de chatear.");
    return;
  }

  if (!texto) return;

  roomRef.child("mensajes").push({
    autor: playerSlot,
    texto,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    ...(currentReply ? { repliedTo: { autorNombre: currentReply.autorNombre, texto: currentReply.texto } } : {})
  });

  dom.mensajeInput.value = "";
  cancelReply();
}

function renderRoom(room) {
  if (!room) return;
  currentRoom = room;
  const jugadores = room.jugadores || {};
  const totalPairs = (room.cartas || []).filter((card) => card.matched).length / 2;

  dom.parejasLabel.textContent = `${Math.min(totalPairs, (room.cartas || []).length / 2)}/${(room.cartas || []).length / 2}`;
  dom.intentosLabel.textContent = String(room.intentos || 0);
  dom.tiempoLabel.textContent = formatTime(room.timer || 0);
  dom.estadoJuego.textContent = room.estado === "finalizado" ? `Ganador: ${room.ganador || "-"}` : `Turno: ${room.turno || "jugador1"}`;

  const cards = room.cartas || [];
  dom.tablero.innerHTML = "";
  cards.forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card" + ((card.visible || card.matched) ? " revealed" : "") + (card.matched ? " matched" : "");
    btn.disabled = Boolean(card.matched || (room.turno !== playerSlot && !card.matched));
    if (room.turno !== playerSlot && room.estado !== "finalizado") {
      btn.disabled = true;
    }
    btn.addEventListener("click", () => handleMultiplayerTurn(index));

    const inner = document.createElement("div");
    inner.className = "card-inner";

    if (card.visible || card.matched) {
      if (card.type === "image") {
        const img = document.createElement("img");
        img.src = card.value;
        img.alt = "Carta";
        img.className = "card-image";
        inner.appendChild(img);
      } else {
        const emoji = document.createElement("span");
        emoji.className = "card-emoji";
        emoji.textContent = card.value;
        inner.appendChild(emoji);
      }
    } else {
      const back = document.createElement("span");
      back.className = "card-back";
      back.textContent = "?";
      inner.appendChild(back);
    }

    btn.appendChild(inner);
    dom.tablero.appendChild(btn);
  });

  const nombre1 = jugadores.jugador1?.nombre || "Jugador 1";
  const nombre2 = jugadores.jugador2?.nombre || "Jugador 2";
  dom.jugadorLabel.textContent = nombre1;
  dom.mensajeEstado.textContent = room.estado === "finalizado"
    ? `¡${room.ganador === playerSlot ? "Has ganado" : "Ha ganado " + (room.ganador || nombre2)}!`
    : `${nombre1} vs ${nombre2}`;
}

function handleMultiplayerTurn(index) {
  if (!roomRef || !playerSlot || !currentRoom) return;
  if (currentRoom.turno !== playerSlot || currentRoom.estado === "finalizado") return;
  const cards = currentRoom.cartas || [];
  const card = cards[index];
  if (!card || card.visible || card.matched || currentRoom.seleccion.includes(index)) return;

  const next = JSON.parse(JSON.stringify(currentRoom));
  next.cartas[index].visible = true;
  next.seleccion = [...(next.seleccion || []), index];
  if (next.seleccion.length === 2) {
    const [firstIndex, secondIndex] = next.seleccion;
    const first = next.cartas[firstIndex];
    const second = next.cartas[secondIndex];
    next.intentos = (next.intentos || 0) + 1;

    if (first.value === second.value) {
      next.cartas[firstIndex].matched = true;
      next.cartas[secondIndex].matched = true;
      next.jugadores[playerSlot].score = (next.jugadores[playerSlot].score || 0) + 1;
      next.seleccion = [];
      const totalPairs = next.cartas.filter((item) => item.matched).length / 2;
      if (next.jugadores[playerSlot].score >= totalPairs) {
        next.estado = "finalizado";
        next.ganador = playerSlot;
      }
    } else {
      next.turno = playerSlot === "jugador1" ? "jugador2" : "jugador1";
      next.seleccion = [];
      window.setTimeout(() => {
        if (!roomRef) return;
        roomRef.once("value").then((snap) => {
          const latest = snap.val();
          if (!latest) return;
          latest.cartas[firstIndex].visible = false;
          latest.cartas[secondIndex].visible = false;
          roomRef.update({ cartas: latest.cartas });
        });
      }, 700);
    }
  }

  roomRef.update({
    cartas: next.cartas,
    turno: next.turno,
    seleccion: next.seleccion,
    jugadores: next.jugadores,
    intentos: next.intentos,
    estado: next.estado || currentRoom.estado,
    ganador: next.ganador || null
  });
}

function createRoom() {
  const nombre = dom.nombreInput.value.trim() || "Invitado";
  if (!nombre) {
    setSessionBanner("Escribe tu nombre para crear una sala.");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  const codigo = generarCodigoSala();
  roomCode = codigo;
  playerSlot = "jugador1";
  dom.codigoInput.value = codigo;
  localStorage.setItem(STORAGE_KEYS.gameCode, codigo);
  clearChat();

  const deckTheme = dom.deckThemeSelect.value;
  const level = dom.dificultadSelect.value;
  const baseDeck = buildDeck(deckTheme, level, customDeck);
  const initialState = {
    codigo,
    estado: "esperando",
    turno: "jugador1",
    timer: 0,
    intentos: 0,
    seleccion: [],
    ganador: null,
    deckTheme,
    jugadores: {
      jugador1: { id: clientId, nombre, score: 0, conectado: true },
      jugador2: null
    },
    cartas: baseDeck,
    mensajes: {}
  };

  roomRef = db.ref(`juegos/memorama-${codigo}`);
  roomRef.set(initialState);
  roomRef.on("value", (snap) => {
    const room = snap.val();
    if (!room) return;
    renderRoom(room);
    if (room.jugadores?.jugador2) {
      setSessionBanner("Sala lista. Comienza la partida.");
      roomRef.update({ estado: "jugando" });
    } else {
      setSessionBanner("Sala creada. Esperando al rival.");
    }
  });
  escucharMensajes();
  registrarPresencia("jugador1");
  dom.codigoJuego.textContent = `Código: ${codigo}`;
  dom.estadoJuego.textContent = "Esperando rival";
}

function joinRoom() {
  const nombre = dom.nombreInput.value.trim() || "Invitado";
  const codigo = dom.codigoInput.value.trim().toLowerCase();
  if (!nombre) {
    setSessionBanner("Escribe tu nombre para unirte.");
    return;
  }
  if (!codigo) {
    setSessionBanner("Escribe el código de la sala.");
    return;
  }

  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  roomCode = codigo;
  localStorage.setItem(STORAGE_KEYS.gameCode, codigo);
  clearChat();

  roomRef = db.ref(`juegos/memorama-${codigo}`);
  roomRef.once("value").then((snap) => {
    const room = snap.val();
    if (!room) {
      setSessionBanner("No existe esa sala.");
      return;
    }

    const jugador2 = room.jugadores?.jugador2;
    const slot = !jugador2 || !jugador2.id ? "jugador2" : null;
    if (!slot) {
      setSessionBanner("La sala ya tiene dos jugadores activos.");
      return;
    }

    playerSlot = slot;
    roomRef.update({
      [`jugadores/${slot}`]: { id: clientId, nombre, score: 0, conectado: true },
      estado: "jugando"
    });
    roomRef.on("value", (valueSnap) => {
      const data = valueSnap.val();
      if (!data) return;
      renderRoom(data);
      setSessionBanner("Te uniste a la sala.");
    });
    escucharMensajes();
    registrarPresencia("jugador2");
    dom.codigoJuego.textContent = `Código: ${codigo}`;
  });
}

function resetModeUI() {
  if (dom.modeSelect.value === "solo") {
    dom.crearJuegoBtn.textContent = "Reiniciar";
    dom.unirseBtn.style.display = "none";
    dom.codigoInput.disabled = true;
    resetSoloGame();
  } else {
    dom.crearJuegoBtn.textContent = "Crear sala";
    dom.unirseBtn.style.display = "inline-flex";
    dom.codigoInput.disabled = false;
    if (roomRef) {
      roomRef.off();
      roomRef = null;
    }
    clearChat();
    dom.tablero.innerHTML = "";
    setSessionBanner("Modo multijugador activo.");
  }
}

function appInit() {
  setPlayerName();
  resetSoloGame();

  dom.modeSelect.addEventListener("change", () => {
    localStorage.setItem("memorama-mode", dom.modeSelect.value);
    resetModeUI();
  });

  dom.dificultadSelect.addEventListener("change", () => {
    if (dom.modeSelect.value === "solo") {
      resetSoloGame();
    }
  });

  dom.deckThemeSelect.addEventListener("change", () => {
    if (dom.modeSelect.value === "solo") {
      resetSoloGame();
    }
  });

  dom.uploadDeckBtn.addEventListener("click", () => dom.uploadDeckInput.click());
  dom.uploadDeckInput.addEventListener("change", (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    files.slice(0, 12).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        customDeck.push(String(reader.result));
        if (dom.modeSelect.value === "solo") {
          resetSoloGame();
        }
      };
      reader.readAsDataURL(file);
    });
    setSessionBanner("Mazo personalizado cargado.");
  });

  dom.crearJuegoBtn.addEventListener("click", () => {
    if (dom.modeSelect.value === "solo") {
      resetSoloGame();
      return;
    }
    createRoom();
  });

  dom.unirseBtn.addEventListener("click", () => {
    if (dom.modeSelect.value === "solo") return;
    joinRoom();
  });

  dom.mensajeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  });

  dom.enviarBtn.addEventListener("click", sendMessage);

  dom.corazonBtn.addEventListener("click", () => {
    if (!roomRef || !playerSlot) return;
    roomRef.child("mensajes").push({
      autor: playerSlot,
      texto: "💖",
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  });

  dom.adjuntarBtn.addEventListener("click", levantarFoto);
  dom.galeriaInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file);
    event.target.value = "";
  });
  dom.camaraInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) uploadImage(file);
    event.target.value = "";
  });

  dom.cancelReplyBtn.addEventListener("click", cancelReply);

  dom.reactionPopup.querySelectorAll(".reaction-emoji").forEach((emoji) => {
    emoji.addEventListener("click", () => addReaction(emoji.dataset.emoji));
  });

  document.addEventListener("click", (event) => {
    if (!dom.reactionPopup.contains(event.target)) dom.reactionPopup.classList.remove("visible");
  });

  dom.themeToggleBtn.addEventListener("click", () => {
    const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(theme);
  });

  dom.instalarBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") {
      dom.instalarBtn.hidden = true;
    }
    deferredInstallPrompt = null;
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dom.instalarBtn.hidden = false;
  });

  applyTheme(getStoredTheme());
  setPlayerName();
  resetModeUI();
}

appInit();
