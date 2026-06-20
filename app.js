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

let jugadorId = null;
let codigoJuego = null;
let estadoJuegoActual = {};
let gameRef = null;
let typingTimer;
let currentReplyingTo = null;
let activeReactionMessageId = null;
let connectedRefListener = null;
let mensajesRefActual = null;
let deferredInstallPrompt = null;
let presenceTimer = null;
let countdownTimer = null;

const PRESENCE_HEARTBEAT_MS = 10000;
const PRESENCE_STALE_MS = 25000;

const STORAGE_KEYS = {
  clientId: "tresenraya-client-id",
  playerName: "tresenraya-player-name",
  gameCode: "tresenraya-game-code",
  theme: "tresenraya-theme"
};

function getOrCreateClientId() {
  const storedId = localStorage.getItem(STORAGE_KEYS.clientId);
  if (storedId) return storedId;

  const newId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(STORAGE_KEYS.clientId, newId);
  return newId;
}

const clientId = getOrCreateClientId();

const dom = {
  tablero: document.getElementById("tablero"),
  estadoJuego: document.getElementById("estadoJuego"),
  codigoJuego: document.getElementById("codigoJuego"),
  crearJuegoBtn: document.getElementById("crearJuegoBtn"),
  unirseBtn: document.getElementById("unirseBtn"),
  reiniciarBtn: document.getElementById("reiniciarBtn"),
  mensajeInput: document.getElementById("mensajeInput"),
  enviarBtn: document.getElementById("enviarBtn"),
  codigoInput: document.getElementById("codigoInput"),
  chatBox: document.getElementById("chatBox"),
  corazonBtn: document.getElementById("corazonBtn"),
  modal: document.getElementById("modal"),
  modalMensaje: document.getElementById("modal-mensaje"),
  nombreInput: document.getElementById("nombreInput"),
  marcador: document.getElementById("marcador"),
  sessionBanner: document.getElementById("sessionBanner"),
  instalarBtn: document.getElementById("instalarBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeColorMeta: document.getElementById("themeColorMeta"),
  countdownBadge: document.getElementById("countdownBadge"),
  player1Badge: document.getElementById("player1Badge"),
  player2Badge: document.getElementById("player2Badge"),
  typingIndicator: document.getElementById("typingIndicator"),
  replyPreview: document.getElementById("replyPreview"),
  replyPreviewAuthor: document.getElementById("replyPreviewAuthor"),
  replyPreviewText: document.getElementById("replyPreviewText"),
  reactionPopup: document.getElementById("reactionPopup"),
  adjuntarBtn: document.getElementById("adjuntarBtn"),
  galeriaInput: document.getElementById("galeriaInput"),
  camaraInput: document.getElementById("camaraInput")
};

dom.nombreInput.value = localStorage.getItem(STORAGE_KEYS.playerName) || "";
dom.codigoInput.value = localStorage.getItem(STORAGE_KEYS.gameCode) || "";

function obtenerTemaInicial() {
  const temaGuardado = localStorage.getItem(STORAGE_KEYS.theme);
  if (temaGuardado === "light" || temaGuardado === "dark") return temaGuardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  const esOscuro = theme === "dark";
  dom.themeToggleBtn.textContent = esOscuro ? "☀️ Modo claro" : "🌙 Modo oscuro";
  dom.themeColorMeta.setAttribute("content", esOscuro ? "#20152d" : "#ff4d88");
}

aplicarTema(obtenerTemaInicial());

function setSessionBanner(texto, state = "idle") {
  dom.sessionBanner.textContent = texto;
  dom.sessionBanner.dataset.state = state;
}

function setCountdownBadge(texto) {
  if (!texto) {
    dom.countdownBadge.hidden = true;
    return;
  }
  dom.countdownBadge.hidden = false;
  dom.countdownBadge.textContent = texto;
}

function actualizarIndicadoresJugadores() {
  const jugadores = [
    { slot: "jugador1", badge: dom.player1Badge, fallback: "Jugador 1" },
    { slot: "jugador2", badge: dom.player2Badge, fallback: "Jugador 2" }
  ];

  jugadores.forEach(({ slot, badge, fallback }) => {
    const jugador = estadoJuegoActual?.[slot];
    const titulo = badge.querySelector("strong");
    const subtitulo = badge.querySelector("span:last-child");
    const turnoTag = badge.querySelector(".turn-tag");
    const activo = esPresenciaActiva(jugador);
    const esTurno = estadoJuegoActual?.turno === slot;
    const esYo = jugador?.id === clientId;

    titulo.textContent = jugador?.nombre || fallback;
    subtitulo.textContent = jugador
      ? `${activo ? "En línea" : "Desconectado"}${esYo ? " · Tú" : ""}${esTurno ? " · Turno" : ""}`
      : "Esperando...";
    turnoTag.textContent = esTurno ? "Turno actual" : "Sin turno";

    badge.dataset.status = jugador ? (activo ? "online" : "offline") : "waiting";
    badge.dataset.activeTurn = esTurno ? "true" : "false";
  });
}

function esJugadorActivo(jugador) {
  return Boolean(jugador && jugador.connected !== false);
}

function obtenerSlotActual() {
  if (estadoJuegoActual?.jugador1?.id === clientId) return "jugador1";
  if (estadoJuegoActual?.jugador2?.id === clientId) return "jugador2";
  return jugadorId;
}

function obtenerSlotOpuesto(slot = obtenerSlotActual()) {
  return slot === "jugador1" ? "jugador2" : "jugador1";
}

function elegirSlotParaUnirse(state) {
  if (state?.jugador1?.id === clientId) return "jugador1";
  if (state?.jugador2?.id === clientId) return "jugador2";
  if (!esPresenciaActiva(state?.jugador1)) return "jugador1";
  if (!esPresenciaActiva(state?.jugador2)) return "jugador2";
  return null;
}

function prepararSesion(slot, nombre, codigo) {
  jugadorId = slot;
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  localStorage.setItem(STORAGE_KEYS.gameCode, codigo);
  dom.nombreInput.value = nombre;
  dom.codigoInput.value = codigo;
}

function esPresenciaActiva(jugador) {
  if (!jugador) return false;
  if (jugador.connected === false) return false;
  if (!jugador.lastSeen) return true;
  return Date.now() - jugador.lastSeen < PRESENCE_STALE_MS;
}

function registrarPresencia(slot) {
  if (!gameRef || !slot) return;

  if (connectedRefListener) {
    connectedRefListener.off();
  }

  connectedRefListener = db.ref(".info/connected");
  connectedRefListener.on("value", (snap) => {
    if (!snap.val() || !gameRef || !slot) return;

    const playerRef = gameRef.child(slot);
    playerRef.onDisconnect().update({
      connected: false,
      isTyping: false,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    playerRef.update({
      id: clientId,
      sessionId: clientId,
      nombre: dom.nombreInput.value.trim(),
      connected: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    if (presenceTimer) {
      clearInterval(presenceTimer);
    }

    presenceTimer = setInterval(() => {
      if (!gameRef || jugadorId !== slot) return;
      playerRef.update({
        connected: true,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
      });
    }, PRESENCE_HEARTBEAT_MS);

    if (navigator.onLine) {
      setSessionBanner(estadoJuegoActual?.estado === "esperando"
        ? "Esperando a que se una tu rival..."
        : "Conexión activa y lista.",
      "success");
    }
  });
}

function detenerEscuchaJuego(ref = gameRef, mensajesRef = mensajesRefActual) {
  if (ref) {
    ref.off("value");
  }
  if (mensajesRef) {
    mensajesRef.off("child_added");
    mensajesRef.off("child_changed");
  }
  if (connectedRefListener) {
    connectedRefListener.off("value");
    connectedRefListener = null;
  }
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
  mensajesRefActual = null;
}

function crearTableroVisual() {
  dom.tablero.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const celda = document.createElement("button");
    celda.type = "button";
    celda.className = "celda";
    celda.dataset.index = String(i);
    celda.innerHTML = "<span></span>";
    celda.addEventListener("click", () => realizarMovimiento(i));
    dom.tablero.appendChild(celda);
  }
}

crearTableroVisual();
crearCorazones(9);

function mostrarEstado(texto) {
  dom.estadoJuego.textContent = texto;
}

function playSound(id) {
  const sound = document.getElementById(id);
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

function crearCorazones(num) {
  const existing = document.querySelectorAll(".corazon");
  existing.forEach((el) => el.remove());
  for (let i = 0; i < num; i++) {
    const heart = document.createElement("div");
    heart.className = "corazon";
    heart.textContent = "❤️";
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.fontSize = `${12 + Math.random() * 18}px`;
    heart.style.animationDuration = `${6 + Math.random() * 8}s`;
    heart.style.animationDelay = `${Math.random() * 4}s`;
    document.body.appendChild(heart);
  }
}

function actualizarEstadoTurno() {
  if (!estadoJuegoActual || !estadoJuegoActual.jugador1 || !estadoJuegoActual.jugador2 || !estadoJuegoActual.turno) return;
  const nombreTurno = estadoJuegoActual[estadoJuegoActual.turno]?.nombre;
  if (!nombreTurno) return;
  mostrarEstado(estadoJuegoActual.turno === jugadorId ? `💖 ¡Es tu turno, ${nombreTurno}!` : `💕 Turno de ${nombreTurno}...`);
}

function estaEnMiSesion() {
  return Boolean(
    estadoJuegoActual?.jugador1?.id === clientId ||
    estadoJuegoActual?.jugador2?.id === clientId
  );
}

function actualizarMarcadorUI() {
  if (!estadoJuegoActual.jugador1 || !estadoJuegoActual.jugador2) {
    dom.marcador.textContent = "";
    return;
  }
  const { nombre: nombre1 } = estadoJuegoActual.jugador1;
  const { jugador1: puntaje1 } = estadoJuegoActual.marcador || { jugador1: 0 };
  const { nombre: nombre2 } = estadoJuegoActual.jugador2;
  const { jugador2: puntaje2 } = estadoJuegoActual.marcador || { jugador2: 0 };
  dom.marcador.textContent = `🏆 ${nombre1}: ${puntaje1} - ${nombre2}: ${puntaje2} 🏆`;
}

function actualizarTableroUI() {
  document.querySelectorAll(".celda").forEach((celda, i) => {
    celda.querySelector("span").textContent = estadoJuegoActual.tablero?.[i] || "";
  });
  if (estadoJuegoActual.lineaGanadora) {
    resaltarGanador(estadoJuegoActual.lineaGanadora, false);
  } else {
    document.querySelectorAll(".celda").forEach((celda) => celda.classList.remove("ganador"));
  }
}

function limpiarCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  setCountdownBadge(null);
}

function iniciarCountdown(inicioEnMs, turnoInicial) {
  limpiarCountdown();

  const tick = () => {
    const restante = Math.max(0, inicioEnMs - Date.now());
    const segundos = Math.ceil(restante / 1000);
    setCountdownBadge(String(Math.max(1, segundos)));
    setSessionBanner(`Empieza en ${Math.max(1, segundos)}...`, "warning");

    if (restante <= 0) {
      limpiarCountdown();
      if (gameRef) {
        gameRef.update({
          estado: "jugando",
          turno: turnoInicial,
          inicioPartidaEn: null
        });
      }
    }
  };

  tick();
  countdownTimer = setInterval(tick, 250);
}

function verificarGanador(tablero, simboloActual) {
  const combos = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (const combo of combos) {
    const [a, b, c] = combo;
    if (tablero[a] === simboloActual && tablero[b] === simboloActual && tablero[c] === simboloActual) {
      return [true, combo];
    }
  }
  return [false, null];
}

function resaltarGanador(indices, remover) {
  indices.forEach((i) => {
    const celda = document.querySelectorAll(".celda")[i];
    if (celda) celda.classList.toggle("ganador", !remover);
  });
}

function mostrarResultado(ganador) {
  let mensaje = "";
  if (ganador === "empate") {
    mensaje = "¡Fue un empate, amores! 💑";
  } else {
    const nombreGanador = estadoJuegoActual[ganador]?.nombre || "jugador";
    mensaje = ganador === jugadorId ? `🎉 ¡Ganaste, ${nombreGanador}! ¡Te amo! 🎉` : `¡Ganó ${nombreGanador}! ¡Felicidades mi amor! 😍`;
  }
  dom.modalMensaje.textContent = mensaje;
  dom.modal.classList.remove("modal-oculto");
  mostrarEstado("Juego terminado.");
}

function ocultarResultado() {
  dom.modal.classList.add("modal-oculto");
}

function actualizarTypingIndicator() {
  const otroJugadorId = obtenerSlotOpuesto();
  if (estadoJuegoActual[otroJugadorId]?.isTyping) {
    dom.typingIndicator.textContent = `${estadoJuegoActual[otroJugadorId].nombre} está escribiendo...`;
  } else {
    dom.typingIndicator.textContent = "";
  }
}

function escucharJuego() {
  if (!gameRef) return;
  detenerEscuchaJuego();

  gameRef.on("value", (snap) => {
    const state = snap.val();
    if (!state) return;
    estadoJuegoActual = state;

    if (state.jugador1?.id === clientId) jugadorId = "jugador1";
    if (state.jugador2?.id === clientId) jugadorId = "jugador2";

    actualizarTableroUI();
    actualizarMarcadorUI();
    actualizarIndicadoresJugadores();
    actualizarTypingIndicator();
    if (state.estado === "finalizado") {
      limpiarCountdown();
      setSessionBanner("Partida finalizada. Puedes reiniciar cuando quieras.", "success");
      mostrarResultado(state.ganador);
    } else if (state.estado === "jugando") {
      limpiarCountdown();
      ocultarResultado();
      setSessionBanner("Partida en curso.", "success");
      actualizarEstadoTurno();
    } else if (state.estado === "cuentaRegresiva") {
      ocultarResultado();
      const inicioEnMs = state.inicioPartidaEn || (Date.now() + 3000);
      iniciarCountdown(inicioEnMs, state.turno || (Math.random() < 0.5 ? "jugador1" : "jugador2"));
    } else if (state.estado === "esperando") {
      limpiarCountdown();
      setSessionBanner("Esperando a tu rival para empezar.", "idle");
      mostrarEstado("Esperando que se una tu amorcito... 🥰");
    } else {
      limpiarCountdown();
      setSessionBanner("Sala lista.", "idle");
      mostrarEstado("Esperando que se una tu amorcito... 🥰");
    }
  });

  mensajesRefActual = gameRef.child("mensajes");
  mensajesRefActual.on("child_added", (snap) => agregarMensajeAlChat(snap.key, snap.val()));
  mensajesRefActual.on("child_changed", (snap) => actualizarMensajeEnChat(snap.key, snap.val()));
}

function agregarMensajeAlChat(id, msg) {
  if (!msg) return;
  const wrapper = document.createElement("div");
  wrapper.className = `mensaje-wrapper ${msg.autor === jugadorId ? "mio" : "suyo"}`;
  wrapper.dataset.id = id;

  const div = document.createElement("div");
  div.className = `mensaje ${msg.autor === jugadorId ? "mio" : "suyo"}`;

  if (msg.repliedTo) {
    const quote = document.createElement("div");
    quote.className = "mensaje-reply-quote";
    quote.innerHTML = `<div class="reply-author">${msg.repliedTo.autorNombre}</div><div class="reply-text">${msg.repliedTo.texto}</div>`;
    div.appendChild(quote);
  }

  const mensajeEsImagen = msg.tipo === "imagen" || Boolean(msg.imagenUrl) || (typeof msg.texto === "string" && /^https?:\/\//i.test(msg.texto));

  if (mensajeEsImagen) {
    const img = document.createElement("img");
    img.src = msg.imagenUrl || msg.texto;
    img.alt = "foto enviada";
    img.loading = "lazy";
    div.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = msg.texto;
    div.appendChild(span);
  }

  const reactions = document.createElement("div");
  reactions.className = "reactions-container";
  div.appendChild(reactions);

  div.addEventListener("click", () => {
    if (msg.tipo !== "imagen") handleReplyClick(id, msg);
  });
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openReactionPopup(id, e);
  });

  wrapper.appendChild(div);
  dom.chatBox.appendChild(wrapper);
  actualizarReacciones(wrapper, msg.reactions);
  dom.chatBox.scrollTop = dom.chatBox.scrollHeight;
}

function actualizarMensajeEnChat(id, msg) {
  const wrapper = dom.chatBox.querySelector(`.mensaje-wrapper[data-id="${id}"]`);
  if (wrapper) actualizarReacciones(wrapper, msg.reactions);
}

function actualizarReacciones(wrapper, reactions) {
  const container = wrapper.querySelector(".reactions-container");
  if (!container) return;
  container.innerHTML = "";
  if (!reactions) return;
  const counts = {};
  for (const userId in reactions) {
    const emoji = reactions[userId];
    counts[emoji] = (counts[emoji] || 0) + 1;
  }
  for (const emoji in counts) {
    const pill = document.createElement("div");
    pill.className = "reaction-pill";
    pill.innerHTML = `<span>${emoji}</span> <strong>${counts[emoji]}</strong>`;
    container.appendChild(pill);
  }
}

function handleReplyClick(id, msg) {
  currentReplyingTo = { id, autorNombre: estadoJuegoActual[msg.autor]?.nombre || "Alguien", texto: msg.texto };
  dom.replyPreviewAuthor.textContent = `Respondiendo a ${currentReplyingTo.autorNombre}`;
  dom.replyPreviewText.textContent = currentReplyingTo.texto;
  dom.replyPreview.style.display = "block";
  dom.mensajeInput.focus();
}

function cancelReply() {
  currentReplyingTo = null;
  dom.replyPreview.style.display = "none";
}

function openReactionPopup(id, event) {
  activeReactionMessageId = id;
  dom.reactionPopup.style.left = `${event.clientX - dom.reactionPopup.offsetWidth / 2}px`;
  dom.reactionPopup.style.top = `${event.clientY - dom.reactionPopup.offsetHeight - 10}px`;
  dom.reactionPopup.classList.add("visible");
}

function addReaction(emoji) {
  if (!activeReactionMessageId || !jugadorId) return;
  gameRef.child(`mensajes/${activeReactionMessageId}/reactions/${jugadorId}`).set(emoji);
  dom.reactionPopup.classList.remove("visible");
  activeReactionMessageId = null;
}

function uploadImage(file) {
  const nombreArchivo = file?.name || "";
  const pareceImagen = Boolean(file && (file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(nombreArchivo)));
  if (!file || !pareceImagen) {
    alert("Solo se pueden enviar imágenes, mi amor 💕");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert("La foto es muy grande. Usa una imagen de hasta 4 MB.");
    return;
  }

  const fileName = `${Date.now()}-${file.name}`;
  const storageRef = storage.ref(`imagenes/${fileName}`);
  const uploadTask = storageRef.put(file);

  uploadTask.on("state_changed", (snapshot) => {
    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
    mostrarEstado(`Subiendo foto: ${progress}%`);
  }, (error) => {
    console.error("Error al subir la imagen:", error);
    mostrarEstado("No se pudo subir la foto 😢");
  }, () => {
    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
      gameRef.child("mensajes").push({
        autor: jugadorId,
        tipo: "imagen",
        imagenUrl: downloadURL,
        texto: "",
        timestamp: firebase.database.ServerValue.TIMESTAMP
      });
      playSound("messageSound");
      mostrarEstado("¡Foto enviada! 💕");
      setTimeout(() => actualizarEstadoTurno(), 1800);
    });
  });
}

function enviarMensajeConImagen(imageUrl) {
  gameRef.child("mensajes").push({
    autor: jugadorId,
    tipo: "imagen",
    imagenUrl: imageUrl,
    texto: "",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  playSound("messageSound");
}

function realizarMovimiento(index) {
  if (estadoJuegoActual.turno !== jugadorId || estadoJuegoActual.tablero[index] !== "" || estadoJuegoActual.estado === "finalizado") return;
  playSound("moveSound");
  const simbolo = estadoJuegoActual[jugadorId]?.simbolo;
  const nuevoTablero = [...estadoJuegoActual.tablero];
  nuevoTablero[index] = simbolo;
  const [haGanado, comb] = verificarGanador(nuevoTablero, simbolo);
  const esEmpate = !haGanado && !nuevoTablero.includes("");

  if (haGanado) {
    playSound("winSound");
    gameRef.child("marcador").child(jugadorId).set(firebase.database.ServerValue.increment(1));
    gameRef.update({ tablero: nuevoTablero, estado: "finalizado", ganador: jugadorId, lineaGanadora: comb });
  } else if (esEmpate) {
    gameRef.update({ tablero: nuevoTablero, estado: "finalizado", ganador: "empate" });
  } else {
    const siguienteTurno = jugadorId === "jugador1" ? "jugador2" : "jugador1";
    gameRef.update({ tablero: nuevoTablero, turno: siguienteTurno });
  }
}

function resetJuego() {
  if (!gameRef) return;

  const ganadorAnterior = estadoJuegoActual?.ganador;
  const puedeIniciarGanador = ganadorAnterior === "jugador1" || ganadorAnterior === "jugador2";
  const turnoInicial = puedeIniciarGanador
    ? ganadorAnterior
    : (Math.random() < 0.5 ? "jugador1" : "jugador2");

  gameRef.update({
    tablero: Array(9).fill(""),
    turno: turnoInicial,
    estado: "jugando",
    ganador: null,
    lineaGanadora: null
  });
  setSessionBanner("Nueva ronda lista.", "success");
}

function abrirSelectorFoto() {
  const usarCamara = window.confirm("Aceptar = cámara, Cancelar = galería");
  if (usarCamara) dom.camaraInput.click();
  else dom.galeriaInput.click();
}

// Events

dom.crearJuegoBtn.addEventListener("click", () => {
  const nombre = dom.nombreInput.value.trim();
  if (!nombre) {
    alert("Por favor, escribe tu nombre mi amor ❤️");
    return;
  }
  detenerEscuchaJuego();
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  codigoJuego = Math.random().toString(36).substr(2, 5);
  jugadorId = "jugador1";
  gameRef = db.ref(`juegos/${codigoJuego}`);
  gameRef.set({
    tablero: Array(9).fill(""),
    turno: Math.random() < 0.5 ? "jugador1" : "jugador2",
    jugador1: { id: clientId, nombre, simbolo: "❤️", isTyping: false, connected: true },
    jugador2: null,
    estado: "esperando",
    ganador: null,
    lineaGanadora: null,
    marcador: { jugador1: 0, jugador2: 0 }
  });
  localStorage.setItem(STORAGE_KEYS.gameCode, codigoJuego);
  dom.codigoJuego.textContent = `Código del juego: ${codigoJuego}`;
  setSessionBanner("Sala creada. Comparte el código con tu rival.", "success");
  escucharJuego();
});

dom.unirseBtn.addEventListener("click", () => {
  const nombre = dom.nombreInput.value.trim();
  if (!nombre) {
    alert("Por favor, escribe tu nombre mi amor ❤️");
    return;
  }
  codigoJuego = document.getElementById("codigoInput").value.trim();
  if (!codigoJuego) return;
  detenerEscuchaJuego();
  gameRef = db.ref(`juegos/${codigoJuego}`);
  localStorage.setItem(STORAGE_KEYS.playerName, nombre);
  localStorage.setItem(STORAGE_KEYS.gameCode, codigoJuego);
  gameRef.once("value").then((snap) => {
    const state = snap.val();
    if (!state) {
      setSessionBanner("No encontré esa sala.", "error");
      alert("No encontré esa sala.");
      return;
    }

    const slot = elegirSlotParaUnirse(state);
    if (!slot) {
      setSessionBanner("Sala ocupada. Prueba con otro código o espera a que alguien salga.", "warning");
      alert("La sala ya tiene dos jugadores activos.");
      return;
    }

    prepararSesion(slot, nombre, codigoJuego);
    const jugadorData = {
      id: clientId,
      nombre,
      simbolo: slot === "jugador1" ? "❤️" : "💙",
      isTyping: false,
      connected: true
    };

    const payload = {
      [slot]: jugadorData,
      estado: state.estado === "esperando" ? "cuentaRegresiva" : state.estado
    };

    if (!state.turno || state.estado === "esperando") {
      payload.turno = Math.random() < 0.5 ? "jugador1" : "jugador2";
      payload.inicioPartidaEn = Date.now() + 3000;
    }

    gameRef.update(payload);
    registrarPresencia(slot);
    escucharJuego();
    setSessionBanner(slot === "jugador1" ? "Te reconectaste como jugador 1." : "Te reconectaste como jugador 2.", "success");
  });
  dom.codigoJuego.textContent = `Código del juego: ${codigoJuego}`;
});

dom.enviarBtn.addEventListener("click", () => {
  const texto = dom.mensajeInput.value.trim();
  if (!texto) return;
  const nuevoMensaje = { autor: jugadorId, texto, timestamp: firebase.database.ServerValue.TIMESTAMP };
  if (currentReplyingTo) nuevoMensaje.repliedTo = currentReplyingTo;
  gameRef.child("mensajes").push(nuevoMensaje);
  playSound("messageSound");
  dom.mensajeInput.value = "";
  cancelReply();
  clearTimeout(typingTimer);
  gameRef.child(jugadorId).update({ isTyping: false });
});

dom.corazonBtn.addEventListener("click", () => {
  playSound("messageSound");
  gameRef.child("mensajes").push({ autor: jugadorId, texto: "❤️", timestamp: firebase.database.ServerValue.TIMESTAMP });
});

dom.adjuntarBtn.addEventListener("click", abrirSelectorFoto);
dom.galeriaInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) uploadImage(file);
  e.target.value = "";
});
dom.camaraInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) uploadImage(file);
  e.target.value = "";
});

 dom.mensajeInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    dom.enviarBtn.click();
  }
});

dom.mensajeInput.addEventListener("input", () => {
  if (!gameRef || !jugadorId) return;
  gameRef.child(jugadorId).update({ isTyping: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => gameRef.child(jugadorId).update({ isTyping: false }), 2000);
});

dom.reiniciarBtn.addEventListener("click", resetJuego);
dom.themeToggleBtn.addEventListener("click", () => {
  const siguienteTema = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  aplicarTema(siguienteTema);
});
dom.instalarBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    setSessionBanner("Tu navegador no mostró la opción de instalar todavía.", "warning");
    return;
  }

  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.instalarBtn.hidden = true;
  setSessionBanner(choice.outcome === "accepted" ? "App instalada en tu dispositivo." : "Instalación cancelada.", choice.outcome === "accepted" ? "success" : "idle");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dom.instalarBtn.hidden = false;
  setSessionBanner("Ya puedes instalar la app en tu pantalla de inicio.", "success");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  dom.instalarBtn.hidden = true;
  setSessionBanner("La app quedó instalada.", "success");
});

window.addEventListener("offline", () => {
  setSessionBanner("Sin conexión. Reconectando...", "warning");
  mostrarEstado("Sin conexión temporalmente...");
});

window.addEventListener("online", () => {
  if (estadoJuegoActual?.estado === "esperando") {
    setSessionBanner("Esperando a que se una tu rival...", "idle");
  } else if (estadoJuegoActual?.estado === "jugando") {
    setSessionBanner("Conexión recuperada.", "success");
  }
});

document.body.addEventListener("click", (e) => {
  if (!dom.reactionPopup.contains(e.target)) dom.reactionPopup.classList.remove("visible");
});

if (!navigator.onLine) {
  setSessionBanner("Sin conexión. La app sigue abierta y se reconecta sola.", "warning");
}
