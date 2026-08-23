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

const MAX_PARTES = 10;
const INTENTOS_BASE = 6;
const PRESENCE_HEARTBEAT_MS = 10000;
const PRESENCE_STALE_MS = 45000;
const ABECEDARIO = "abcdefghijklmnñopqrstuvwxyz".split("");
const CATEGORIA_AZAR = "__azar__";
// Las salas viven bajo "juegos/" porque es la rama habilitada en las reglas de Firebase.
const RUTA_SALA = (codigo) => `juegos/ahorcado-${codigo}`;

const STORAGE_KEYS = {
  clientId: "ahorcado-client-id",
  playerName: "ahorcado-player-name",
  gameCode: "ahorcado-game-code",
  theme: "tresenraya-theme" // compartido con el resto de la plataforma
};

let jugadorId = null;
let codigoJuego = null;
let estadoJuegoActual = {};
let gameRef = null;
let mensajesRefActual = null;
let connectedRefListener = null;
let presenceTimer = null;
let typingTimer = null;
let currentReplyingTo = null;
let activeReactionMessageId = null;
let deferredInstallPrompt = null;
let ultimoEstadoRenderizado = null;
let categoriaSugerida = null;
let palabraSugerida = "";
const palabrasYaSugeridas = new Set();

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

// Alfabeto sin caracteres que se confunden al dictarlos (i, l, o, 0, 1).
function generarCodigoSala(longitud = 8) {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789";
  const valores = new Uint32Array(longitud);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(valores);
  } else {
    valores.forEach((_, i) => { valores[i] = Math.floor(Math.random() * 4294967296); });
  }

  return Array.from(valores, (valor) => alfabeto[valor % alfabeto.length]).join("");
}

const dom = {
  nombreInput: document.getElementById("nombreInput"),
  codigoInput: document.getElementById("codigoInput"),
  crearJuegoBtn: document.getElementById("crearJuegoBtn"),
  unirseBtn: document.getElementById("unirseBtn"),
  instalarBtn: document.getElementById("instalarBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeColorMeta: document.getElementById("themeColorMeta"),
  sessionBanner: document.getElementById("sessionBanner"),
  player1Badge: document.getElementById("player1Badge"),
  player2Badge: document.getElementById("player2Badge"),
  codigoJuego: document.getElementById("codigoJuego"),
  marcador: document.getElementById("marcador"),
  estadoJuego: document.getElementById("estadoJuego"),
  setupPanel: document.getElementById("setupPanel"),
  categoriaSelect: document.getElementById("categoriaSelect"),
  palabraInput: document.getElementById("palabraInput"),
  pistaInput: document.getElementById("pistaInput"),
  sugerirBtn: document.getElementById("sugerirBtn"),
  empezarRondaBtn: document.getElementById("empezarRondaBtn"),
  waitingPanel: document.getElementById("waitingPanel"),
  waitingText: document.getElementById("waitingText"),
  playPanel: document.getElementById("playPanel"),
  categoriaBadge: document.getElementById("categoriaBadge"),
  dificultadBadge: document.getElementById("dificultadBadge"),
  intentosPreview: document.getElementById("intentosPreview"),
  vidasBox: document.getElementById("vidasBox"),
  gallows: document.querySelector(".gallows"),
  palabraDisplay: document.getElementById("palabraDisplay"),
  verPistaBtn: document.getElementById("verPistaBtn"),
  revelarLetraBtn: document.getElementById("revelarLetraBtn"),
  pistaTexto: document.getElementById("pistaTexto"),
  teclado: document.getElementById("teclado"),
  letrasFalladas: document.getElementById("letrasFalladas"),
  modal: document.getElementById("modal"),
  modalMensaje: document.getElementById("modal-mensaje"),
  modalPalabra: document.getElementById("modal-palabra"),
  reiniciarBtn: document.getElementById("reiniciarBtn"),
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
  reactionPopup: document.getElementById("reactionPopup")
};

dom.nombreInput.value = localStorage.getItem(STORAGE_KEYS.playerName) || "";
dom.codigoInput.value = localStorage.getItem(STORAGE_KEYS.gameCode) || "";

/* ---------------- Tema y ambiente ---------------- */

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
  dom.themeColorMeta.setAttribute("content", esOscuro ? "#1e1836" : "#7b5cff");
}

aplicarTema(obtenerTemaInicial());

function crearLetrasFlotantes(cantidad) {
  for (let i = 0; i < cantidad; i++) {
    const letra = document.createElement("div");
    letra.className = "letra-flotante";
    letra.textContent = ABECEDARIO[Math.floor(Math.random() * ABECEDARIO.length)].toUpperCase();
    letra.style.left = `${Math.random() * 92}vw`;
    letra.style.fontSize = `${14 + Math.random() * 22}px`;
    letra.style.animationDuration = `${9 + Math.random() * 9}s`;
    letra.style.animationDelay = `${Math.random() * 6}s`;
    document.body.appendChild(letra);
  }
}

crearLetrasFlotantes(12);

function lanzarConfeti() {
  const colores = ["#7b5cff", "#b39dff", "#ffb347", "#17b978", "#ff6b8b"];
  for (let i = 0; i < 40; i++) {
    const pieza = document.createElement("div");
    pieza.className = "confeti";
    pieza.style.left = `${Math.random() * 100}vw`;
    pieza.style.background = colores[Math.floor(Math.random() * colores.length)];
    pieza.style.animationDelay = `${Math.random() * 0.6}s`;
    document.body.appendChild(pieza);
    setTimeout(() => pieza.remove(), 3200);
  }
}

function playSound(id) {
  const sound = document.getElementById(id);
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  }
}

/* ---------------- Utilidades de texto ---------------- */

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/~/g, "ñ");
}

function esLetra(caracter) {
  return /[a-zñ]/.test(caracter);
}

function letrasUnicas(palabra) {
  return [...new Set(normalizar(palabra).split("").filter(esLetra))];
}

// Palabras más largas dan más intentos: 6 (normal), 8 (larga) o 10 (muy larga o frase).
function calcularIntentos(palabra) {
  const unicas = letrasUnicas(palabra).length;
  const totalLetras = normalizar(palabra).split("").filter(esLetra).length;
  const palabras = String(palabra).trim().split(/\s+/).filter(Boolean).length;

  if (palabras > 1 || unicas > 9 || totalLetras > 14) return 10;
  if (unicas > 6 || totalLetras > 8) return 8;
  return INTENTOS_BASE;
}

function etiquetaDificultad(intentos) {
  if (intentos >= 10) return "Muy larga";
  if (intentos >= 8) return "Larga";
  return "Normal";
}

function intentosDeRonda() {
  return estadoJuegoActual?.maxErrores || INTENTOS_BASE;
}

/* ---------------- Estado y roles ---------------- */

function setSessionBanner(texto, state = "idle") {
  dom.sessionBanner.textContent = texto;
  dom.sessionBanner.dataset.state = state;
}

function mostrarEstado(texto) {
  dom.estadoJuego.textContent = texto;
}

function esPresenciaActiva(jugador) {
  if (!jugador) return false;
  if (!jugador.lastSeen) return jugador.connected !== false;
  return Date.now() - jugador.lastSeen < PRESENCE_STALE_MS;
}

function slotOpuesto(slot) {
  return slot === "jugador1" ? "jugador2" : "jugador1";
}

function slotEscritor() {
  return estadoJuegoActual?.escritor || "jugador1";
}

function slotAdivinador() {
  return slotOpuesto(slotEscritor());
}

function soyEscritor() {
  return jugadorId === slotEscritor();
}

function soyAdivinador() {
  return jugadorId === slotAdivinador();
}

function nombreDe(slot) {
  return estadoJuegoActual?.[slot]?.nombre || (slot === "jugador1" ? "Jugador 1" : "Jugador 2");
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

// El chat es de cada sala: al cambiar de código se vacía y vuelve a cargarse desde la nueva sala.
function limpiarChat() {
  dom.chatBox.replaceChildren();
  dom.typingIndicator.textContent = "";
  cancelReply();
}

function actualizarIndicadoresJugadores() {
  [
    { slot: "jugador1", badge: dom.player1Badge, fallback: "Jugador 1" },
    { slot: "jugador2", badge: dom.player2Badge, fallback: "Jugador 2" }
  ].forEach(({ slot, badge, fallback }) => {
    const jugador = estadoJuegoActual?.[slot];
    const titulo = badge.querySelector("strong");
    const subtitulo = badge.querySelector(".player-meta span");
    const rolTag = badge.querySelector(".turn-tag");
    const activo = esPresenciaActiva(jugador);
    const esYo = jugador?.id === clientId;
    const esEscritor = slot === slotEscritor();
    const enTurno = estadoJuegoActual?.estado === "eligiendo"
      ? esEscritor
      : estadoJuegoActual?.estado === "jugando" && !esEscritor;

    titulo.textContent = jugador?.nombre || fallback;
    subtitulo.textContent = jugador
      ? `${activo ? "En línea" : "Desconectado"}${esYo ? " · Tú" : ""}`
      : "Esperando...";
    rolTag.textContent = jugador ? (esEscritor ? "🤫 Esconde la palabra" : "🔍 Adivina") : "Sin rol";

    badge.dataset.status = jugador ? (activo ? "online" : "offline") : "waiting";
    badge.dataset.activeTurn = enTurno ? "true" : "false";
  });
}

function actualizarMarcadorUI() {
  if (!estadoJuegoActual.jugador1 || !estadoJuegoActual.jugador2) {
    dom.marcador.textContent = "";
    return;
  }
  const marcador = estadoJuegoActual.marcador || { jugador1: 0, jugador2: 0 };
  const ronda = estadoJuegoActual.ronda || 1;
  dom.marcador.textContent = `🏆 ${nombreDe("jugador1")}: ${marcador.jugador1 || 0} - ${nombreDe("jugador2")}: ${marcador.jugador2 || 0} · Ronda ${ronda}`;
}

/* ---------------- Render del juego ---------------- */

function construirTeclado() {
  dom.teclado.replaceChildren(...ABECEDARIO.map((letra) => {
    const tecla = document.createElement("button");
    tecla.type = "button";
    tecla.className = "tecla";
    tecla.dataset.letra = letra;
    tecla.textContent = letra;
    tecla.addEventListener("click", () => intentarLetra(letra));
    return tecla;
  }));
}

construirTeclado();

function letrasProbadas() {
  return Object.keys(estadoJuegoActual?.letras || {});
}

function renderPalabra() {
  const palabra = estadoJuegoActual?.palabra || "";
  const normalizada = normalizar(palabra);
  const probadas = letrasProbadas();
  const finalizado = estadoJuegoActual?.estado === "finalizado";
  const mostrarTodo = soyEscritor() || finalizado;

  const grupos = [];
  let grupoActual = document.createElement("div");
  grupoActual.className = "palabra-grupo";

  palabra.split("").forEach((caracter, indice) => {
    if (caracter === " ") {
      grupos.push(grupoActual);
      grupoActual = document.createElement("div");
      grupoActual.className = "palabra-grupo";
      return;
    }

    const slot = document.createElement("span");
    slot.className = "letra-slot";
    const letraNormalizada = normalizada[indice];

    if (!esLetra(letraNormalizada)) {
      slot.textContent = caracter;
      slot.style.borderBottomColor = "transparent";
    } else if (probadas.includes(letraNormalizada)) {
      slot.textContent = caracter;
      slot.classList.add("revelada");
    } else if (mostrarTodo) {
      slot.textContent = caracter;
      if (finalizado) slot.classList.add("oculta-final");
    } else {
      slot.textContent = "";
    }

    grupoActual.appendChild(slot);
  });

  grupos.push(grupoActual);
  dom.palabraDisplay.replaceChildren(...grupos);
}

function renderVidas(errores) {
  const total = intentosDeRonda();
  const corazones = Array.from({ length: total }, (_, i) => {
    const span = document.createElement("span");
    span.textContent = "💜";
    if (i < errores) span.classList.add("perdida");
    return span;
  });
  dom.vidasBox.replaceChildren(...corazones);
}

// Cada fallo dibuja una parte más: 6 intentos = muñeco básico, 8 o 10 añaden manos y pies.
function renderAhorcado(errores) {
  const partesVisibles = Math.min(errores, MAX_PARTES);
  dom.gallows.querySelectorAll(".cuerpo-parte").forEach((parte) => {
    parte.classList.toggle("visible", Number(parte.dataset.parte) <= partesVisibles);
  });
}

function renderTeclado() {
  const probadas = letrasProbadas();
  const normalizada = normalizar(estadoJuegoActual?.palabra || "");
  const jugando = estadoJuegoActual?.estado === "jugando";

  dom.teclado.querySelectorAll(".tecla").forEach((tecla) => {
    const letra = tecla.dataset.letra;
    const usada = probadas.includes(letra);
    tecla.classList.toggle("acierto", usada && normalizada.includes(letra));
    tecla.classList.toggle("fallo", usada && !normalizada.includes(letra));
    tecla.disabled = usada || !jugando || !soyAdivinador();
  });

  const falladas = probadas.filter((letra) => !normalizada.includes(letra));
  dom.letrasFalladas.textContent = falladas.length
    ? `Letras falladas: ${falladas.join(" · ").toUpperCase()}`
    : "";
}

function renderPistas() {
  const hayPista = Boolean(estadoJuegoActual?.pista);
  const revelada = Boolean(estadoJuegoActual?.pistaRevelada);
  const jugando = estadoJuegoActual?.estado === "jugando";

  dom.verPistaBtn.hidden = !hayPista || revelada || !jugando || !soyAdivinador();
  dom.pistaTexto.hidden = !(hayPista && (revelada || soyEscritor()));
  dom.pistaTexto.textContent = hayPista ? `💡 ${estadoJuegoActual.pista}` : "";

  const letrasPendientes = letrasUnicas(estadoJuegoActual?.palabra).filter(
    (letra) => !letrasProbadas().includes(letra)
  );
  const comodinUsado = Boolean(estadoJuegoActual?.letraRevelada);
  dom.revelarLetraBtn.hidden = !jugando || !soyAdivinador() || comodinUsado || letrasPendientes.length <= 1;
  dom.revelarLetraBtn.disabled = (estadoJuegoActual?.errores || 0) >= intentosDeRonda() - 1;
}

function mostrarPanel(nombre) {
  dom.setupPanel.hidden = nombre !== "setup";
  dom.waitingPanel.hidden = nombre !== "waiting";
  dom.playPanel.hidden = nombre !== "play";
}

function renderJuego() {
  const estado = estadoJuegoActual?.estado;
  const errores = estadoJuegoActual?.errores || 0;

  actualizarIndicadoresJugadores();
  actualizarMarcadorUI();

  if (estado === "esperando" || !estadoJuegoActual?.jugador2) {
    mostrarPanel("waiting");
    dom.waitingText.textContent = "Comparte el código y espera a tu rival para empezar...";
    mostrarEstado("Esperando al segundo jugador 🔤");
    return;
  }

  if (estado === "eligiendo") {
    if (soyEscritor()) {
      mostrarPanel("setup");
      mostrarEstado("Escribe la palabra secreta y envíala 🤫");
      setSessionBanner(`Ronda ${estadoJuegoActual.ronda || 1}: te toca esconder la palabra.`, "success");
    } else {
      mostrarPanel("waiting");
      dom.waitingText.textContent = `${nombreDe(slotEscritor())} está eligiendo la palabra secreta...`;
      mostrarEstado("Prepárate para adivinar 🔍");
      setSessionBanner(`Ronda ${estadoJuegoActual.ronda || 1}: te toca adivinar.`, "success");
    }
    return;
  }

  mostrarPanel("play");
  dom.categoriaBadge.textContent = estadoJuegoActual?.categoria || "Libre";
  dom.dificultadBadge.textContent = `${etiquetaDificultad(intentosDeRonda())} · ${intentosDeRonda()} intentos`;
  renderPalabra();
  renderVidas(errores);
  renderAhorcado(errores);
  renderTeclado();
  renderPistas();

  if (estado === "jugando") {
    const restantes = intentosDeRonda() - errores;
    if (soyAdivinador()) {
      mostrarEstado(`Tu turno: elige una letra · te quedan ${restantes} intento${restantes === 1 ? "" : "s"}`);
      setSessionBanner("Partida en curso. ¡Adivina la palabra!", "success");
    } else {
      mostrarEstado(`${nombreDe(slotAdivinador())} está adivinando... le quedan ${restantes} intento${restantes === 1 ? "" : "s"}`);
      setSessionBanner("Partida en curso. Observa cómo lo intenta.", "success");
    }
  }
}

function mostrarResultado() {
  const ganador = estadoJuegoActual?.ganador;
  const gane = (ganador === "adivinador" && soyAdivinador()) || (ganador === "escritor" && soyEscritor());

  if (ganador === "adivinador") {
    dom.modalMensaje.textContent = gane
      ? "🎉 ¡Adivinaste la palabra!"
      : `😮 ${nombreDe(slotAdivinador())} descubrió tu palabra`;
  } else {
    dom.modalMensaje.textContent = gane
      ? "🤫 ¡Nadie descubrió tu palabra!"
      : "💀 Te quedaste sin intentos";
  }

  dom.modalPalabra.textContent = `La palabra era: ${String(estadoJuegoActual?.palabra || "").toUpperCase()}`;
  dom.modal.classList.remove("modal-oculto");
  mostrarEstado("Ronda terminada.");

  if (gane) {
    playSound("winSound");
    lanzarConfeti();
  }
}

function ocultarResultado() {
  dom.modal.classList.add("modal-oculto");
}

/* ---------------- Acciones del juego ---------------- */

function finalizarRonda(ganador, extra = {}) {
  const slotGanador = ganador === "adivinador" ? slotAdivinador() : slotEscritor();
  gameRef.child("marcador").child(slotGanador).set(firebase.database.ServerValue.increment(1));
  gameRef.update({ ...extra, estado: "finalizado", ganador });
}

function aplicarIntento(letra) {
  const normalizada = normalizar(estadoJuegoActual.palabra);
  const acierta = normalizada.includes(letra);
  const nuevasLetras = { ...(estadoJuegoActual.letras || {}), [letra]: true };
  const nuevosErrores = (estadoJuegoActual.errores || 0) + (acierta ? 0 : 1);
  const adivinoTodo = letrasUnicas(estadoJuegoActual.palabra).every((l) => nuevasLetras[l]);

  playSound(acierta ? "moveSound" : "failSound");
  if (!acierta) {
    dom.gallows.classList.remove("sacudir");
    void dom.gallows.offsetWidth;
    dom.gallows.classList.add("sacudir");
  }

  if (adivinoTodo) {
    finalizarRonda("adivinador", { letras: nuevasLetras, errores: nuevosErrores });
  } else if (nuevosErrores >= intentosDeRonda()) {
    finalizarRonda("escritor", { letras: nuevasLetras, errores: nuevosErrores });
  } else {
    gameRef.update({ letras: nuevasLetras, errores: nuevosErrores });
  }
}

function intentarLetra(letra) {
  if (!gameRef || estadoJuegoActual?.estado !== "jugando") return;
  if (!soyAdivinador()) {
    setSessionBanner("Esta ronda te toca esconder la palabra, no adivinar.", "warning");
    return;
  }
  if (letrasProbadas().includes(letra)) return;

  aplicarIntento(letra);
}

function revelarLetraAlAzar() {
  if (!gameRef || estadoJuegoActual?.estado !== "jugando" || !soyAdivinador()) return;
  if (estadoJuegoActual?.letraRevelada) return;

  const pendientes = letrasUnicas(estadoJuegoActual.palabra).filter(
    (letra) => !letrasProbadas().includes(letra)
  );
  if (pendientes.length <= 1) return;

  const letra = pendientes[Math.floor(Math.random() * pendientes.length)];
  const nuevasLetras = { ...(estadoJuegoActual.letras || {}), [letra]: true };
  const nuevosErrores = (estadoJuegoActual.errores || 0) + 1;

  playSound("moveSound");

  if (nuevosErrores >= intentosDeRonda()) {
    finalizarRonda("escritor", { letras: nuevasLetras, errores: nuevosErrores, letraRevelada: true });
  } else {
    gameRef.update({ letras: nuevasLetras, errores: nuevosErrores, letraRevelada: true });
  }
}

function enviarPalabraSecreta() {
  if (!gameRef || !soyEscritor()) return;

  const palabra = dom.palabraInput.value.trim().replace(/\s+/g, " ");
  const normalizada = normalizar(palabra);

  if (!/^[a-zñ][a-zñ \-]*$/.test(normalizada)) {
    setSessionBanner("Usa solo letras, espacios o guiones en la palabra.", "error");
    return;
  }
  if (letrasUnicas(palabra).length < 3) {
    setSessionBanner("La palabra necesita al menos 3 letras distintas.", "error");
    return;
  }
  if (palabra.length > 40) {
    setSessionBanner("La frase es muy larga (máximo 40 caracteres).", "error");
    return;
  }

  gameRef.update({
    palabra,
    categoria: categoriaSugerida || (dom.categoriaSelect.value === CATEGORIA_AZAR ? "Libre" : dom.categoriaSelect.value),
    pista: dom.pistaInput.value.trim().slice(0, 60),
    pistaRevelada: false,
    letras: null,
    errores: 0,
    maxErrores: calcularIntentos(palabra),
    letraRevelada: false,
    ganador: null,
    estado: "jugando"
  });

  categoriaSugerida = null;
  palabraSugerida = "";
  dom.palabraInput.value = "";
  dom.pistaInput.value = "";
  setSessionBanner("Palabra enviada. ¡A ver si la descubre!", "success");
}

function nuevaRonda() {
  if (!gameRef) return;

  gameRef.update({
    escritor: slotAdivinador(),
    ronda: (estadoJuegoActual?.ronda || 1) + 1,
    palabra: "",
    categoria: "",
    pista: "",
    pistaRevelada: false,
    letras: null,
    errores: 0,
    maxErrores: INTENTOS_BASE,
    letraRevelada: false,
    ganador: null,
    estado: "eligiendo"
  });

  ocultarResultado();
  setSessionBanner("Nueva ronda: cambian los roles.", "success");
}

function estadoInicialSala(nombre) {
  return {
    jugador1: { id: clientId, nombre, isTyping: false, connected: true },
    jugador2: null,
    estado: "esperando",
    escritor: "jugador1",
    ronda: 1,
    palabra: "",
    categoria: "",
    pista: "",
    pistaRevelada: false,
    letras: null,
    errores: 0,
    maxErrores: INTENTOS_BASE,
    letraRevelada: false,
    ganador: null,
    marcador: { jugador1: 0, jugador2: 0 }
  };
}

/* ---------------- Presencia y escucha ---------------- */

function registrarPresencia(slot) {
  if (!gameRef || !slot) return;

  if (connectedRefListener) connectedRefListener.off();

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
      nombre: dom.nombreInput.value.trim(),
      connected: true,
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });

    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = setInterval(() => {
      if (!gameRef || jugadorId !== slot) return;
      playerRef.update({ connected: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    }, PRESENCE_HEARTBEAT_MS);
  });
}

function detenerEscuchaJuego(ref = gameRef, mensajesRef = mensajesRefActual, limpiarPresencia = true) {
  if (ref) ref.off("value");
  if (mensajesRef) {
    mensajesRef.off("child_added");
    mensajesRef.off("child_changed");
  }
  if (limpiarPresencia) {
    if (connectedRefListener) {
      connectedRefListener.off("value");
      connectedRefListener = null;
    }
    if (presenceTimer) {
      clearInterval(presenceTimer);
      presenceTimer = null;
    }
  }
  mensajesRefActual = null;
}

function escucharJuego() {
  if (!gameRef) return;
  detenerEscuchaJuego(gameRef, mensajesRefActual, false);

  gameRef.on("value", (snap) => {
    const state = snap.val();
    if (!state) return;
    estadoJuegoActual = state;

    if (state.jugador1?.id === clientId) jugadorId = "jugador1";
    if (state.jugador2?.id === clientId) jugadorId = "jugador2";

    actualizarTypingIndicator();
    renderJuego();

    if (state.estado === "finalizado") {
      if (ultimoEstadoRenderizado !== "finalizado") mostrarResultado();
    } else {
      ocultarResultado();
    }

    ultimoEstadoRenderizado = state.estado;
  });

  mensajesRefActual = gameRef.child("mensajes");
  mensajesRefActual.on("child_added", (snap) => agregarMensajeAlChat(snap.key, snap.val()));
  mensajesRefActual.on("child_changed", (snap) => actualizarMensajeEnChat(snap.key, snap.val()));
}

/* ---------------- Chat ---------------- */

function actualizarTypingIndicator() {
  const otro = slotOpuesto(jugadorId || "jugador1");
  dom.typingIndicator.textContent = estadoJuegoActual?.[otro]?.isTyping
    ? `${nombreDe(otro)} está escribiendo...`
    : "";
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
    const autor = document.createElement("div");
    autor.className = "reply-author";
    autor.textContent = msg.repliedTo.autorNombre || "";
    const texto = document.createElement("div");
    texto.className = "reply-text";
    texto.textContent = msg.repliedTo.texto || "";
    quote.append(autor, texto);
    div.appendChild(quote);
  }

  if (msg.tipo === "imagen" && msg.imagenUrl) {
    const img = document.createElement("img");
    img.src = msg.imagenUrl;
    img.alt = "foto enviada";
    img.loading = "lazy";
    div.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.textContent = msg.texto || "";
    div.appendChild(span);
  }

  const reactions = document.createElement("div");
  reactions.className = "reactions-container";
  div.appendChild(reactions);

  div.addEventListener("click", () => {
    if (div.dataset.pulsacionLarga === "true") {
      delete div.dataset.pulsacionLarga;
      return;
    }
    if (msg.tipo !== "imagen") handleReplyClick(id, msg);
  });
  div.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openReactionPopup(id, event);
  });
  activarPulsacionLarga(div, id);

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

  container.replaceChildren();
  if (!reactions) return;

  const counts = {};
  Object.values(reactions).forEach((emoji) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
  });

  Object.entries(counts).forEach(([emoji, total]) => {
    const pill = document.createElement("div");
    pill.className = "reaction-pill";
    const span = document.createElement("span");
    span.textContent = emoji;
    const strong = document.createElement("strong");
    strong.textContent = ` ${total}`;
    pill.append(span, strong);
    container.appendChild(pill);
  });
}

function handleReplyClick(id, msg) {
  currentReplyingTo = {
    id,
    autorNombre: nombreDe(msg.autor),
    texto: msg.texto || ""
  };
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
  const popup = dom.reactionPopup;
  const punto = event.touches?.[0] || event.changedTouches?.[0] || event;
  const margen = 10;

  popup.classList.add("visible");

  const ancho = popup.offsetWidth;
  const alto = popup.offsetHeight;
  const maxX = Math.max(margen, window.innerWidth - ancho - margen);
  const maxY = Math.max(margen, window.innerHeight - alto - margen);

  const x = Math.min(Math.max((punto.clientX || 0) - ancho / 2, margen), maxX);
  const arriba = (punto.clientY || 0) - alto - 12;
  const y = Math.min(Math.max(arriba < margen ? (punto.clientY || 0) + 18 : arriba, margen), maxY);

  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
}

// Pulsación larga en pantallas táctiles para abrir las reacciones.
function activarPulsacionLarga(elemento, id) {
  let temporizador = null;

  const cancelar = () => {
    clearTimeout(temporizador);
    temporizador = null;
  };

  elemento.addEventListener("touchstart", (event) => {
    const toque = event.touches[0];
    temporizador = setTimeout(() => {
      elemento.dataset.pulsacionLarga = "true";
      openReactionPopup(id, toque);
      if (navigator.vibrate) navigator.vibrate(15);
    }, 450);
  }, { passive: true });

  elemento.addEventListener("touchmove", cancelar, { passive: true });
  elemento.addEventListener("touchend", cancelar);
  elemento.addEventListener("touchcancel", cancelar);
}

function addReaction(emoji) {
  if (!activeReactionMessageId || !jugadorId || !gameRef) return;
  gameRef.child(`mensajes/${activeReactionMessageId}/reactions/${jugadorId}`).set(emoji);
  dom.reactionPopup.classList.remove("visible");
  activeReactionMessageId = null;
}

function uploadImage(file) {
  const pareceImagen = Boolean(file && (file.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(file.name || "")));
  if (!pareceImagen) {
    setSessionBanner("Solo se pueden enviar imágenes.", "warning");
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    setSessionBanner("La foto es muy grande (máximo 12 MB).", "warning");
    return;
  }

  const storageRef = storage.ref(`imagenes/${Date.now()}-${file.name}`);
  const uploadTask = storageRef.put(file);

  uploadTask.on("state_changed", (snapshot) => {
    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
    setSessionBanner(`Subiendo foto: ${progress}%`, "idle");
  }, () => {
    setSessionBanner("No se pudo subir la foto.", "error");
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
      setSessionBanner("¡Foto enviada!", "success");
    });
  });
}

function abrirSelectorFoto() {
  const usarCamara = window.confirm("Aceptar = cámara, Cancelar = galería");
  if (usarCamara) dom.camaraInput.click();
  else dom.galeriaInput.click();
}

/* ---------------- Eventos ---------------- */

Object.keys(window.CATEGORIAS_AHORCADO || {}).forEach((categoria) => {
  const option = document.createElement("option");
  option.value = categoria;
  option.textContent = categoria;
  dom.categoriaSelect.appendChild(option);
});

const opcionAzar = document.createElement("option");
opcionAzar.value = CATEGORIA_AZAR;
opcionAzar.textContent = "🎲 Sorpréndeme";
dom.categoriaSelect.insertBefore(opcionAzar, dom.categoriaSelect.firstChild);
dom.categoriaSelect.value = CATEGORIA_AZAR;

function categoriasConPalabras() {
  return Object.keys(window.CATEGORIAS_AHORCADO || {})
    .filter((categoria) => (window.CATEGORIAS_AHORCADO[categoria] || []).length > 0);
}

function sugerirPalabra() {
  const disponibles = categoriasConPalabras();
  if (!disponibles.length) return;

  const seleccion = dom.categoriaSelect.value;
  const categoria = seleccion === CATEGORIA_AZAR || !window.CATEGORIAS_AHORCADO[seleccion]?.length
    ? disponibles[Math.floor(Math.random() * disponibles.length)]
    : seleccion;

  const banco = window.CATEGORIAS_AHORCADO[categoria];
  let candidatas = banco.filter((palabra) => !palabrasYaSugeridas.has(palabra));
  if (!candidatas.length) {
    banco.forEach((palabra) => palabrasYaSugeridas.delete(palabra));
    candidatas = banco;
  }

  const elegida = candidatas[Math.floor(Math.random() * candidatas.length)];
  palabrasYaSugeridas.add(elegida);
  categoriaSugerida = categoria;
  palabraSugerida = elegida;

  dom.palabraInput.value = elegida;
  dom.palabraInput.dispatchEvent(new Event("input"));
  setSessionBanner(`Sugerencia de la categoría ${categoria}.`, "idle");
}

dom.sugerirBtn.addEventListener("click", sugerirPalabra);

dom.empezarRondaBtn.addEventListener("click", enviarPalabraSecreta);
dom.palabraInput.addEventListener("input", () => {
  const valor = dom.palabraInput.value.trim();
  const intentos = calcularIntentos(valor);
  dom.intentosPreview.textContent = `Intentos para tu rival: ${intentos} (${etiquetaDificultad(intentos).toLowerCase()})`;
  // Si el jugador escribe su propia palabra, la categoría sugerida deja de aplicar.
  if (valor.toLowerCase() !== palabraSugerida) categoriaSugerida = null;
});

dom.categoriaSelect.addEventListener("change", () => { categoriaSugerida = null; });
dom.palabraInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    enviarPalabraSecreta();
  }
});

dom.verPistaBtn.addEventListener("click", () => {
  if (gameRef) gameRef.update({ pistaRevelada: true });
});

dom.revelarLetraBtn.addEventListener("click", revelarLetraAlAzar);
dom.reiniciarBtn.addEventListener("click", nuevaRonda);

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, textarea")) return;
  const letra = normalizar(event.key);
  if (letra.length === 1 && esLetra(letra)) intentarLetra(letra);
});

dom.crearJuegoBtn.addEventListener("click", () => {
  const nombre = dom.nombreInput.value.trim();
  if (!nombre) {
    setSessionBanner("Escribe tu nombre para crear la sala.", "warning");
    return;
  }

  detenerEscuchaJuego();
  limpiarChat();
  codigoJuego = generarCodigoSala();
  jugadorId = "jugador1";
  gameRef = db.ref(RUTA_SALA(codigoJuego));
  gameRef.set(estadoInicialSala(nombre));
  prepararSesion("jugador1", nombre, codigoJuego);

  dom.codigoJuego.textContent = `Código de la sala: ${codigoJuego}`;
  setSessionBanner("Sala creada. Comparte el código con tu rival.", "success");
  registrarPresencia("jugador1");
  escucharJuego();
});

dom.unirseBtn.addEventListener("click", () => {
  const nombre = dom.nombreInput.value.trim();
  if (!nombre) {
    setSessionBanner("Escribe tu nombre para unirte.", "warning");
    return;
  }

  const codigo = dom.codigoInput.value.trim().toLowerCase();
  if (!codigo) {
    setSessionBanner("Escribe el código de la sala.", "warning");
    return;
  }

  detenerEscuchaJuego();
  limpiarChat();
  codigoJuego = codigo;
  gameRef = db.ref(RUTA_SALA(codigo));

  gameRef.once("value").then((snap) => {
    const state = snap.val();
    if (!state) {
      setSessionBanner("No encontré esa sala.", "error");
      return;
    }

    const slot = elegirSlotParaUnirse(state);
    if (!slot) {
      setSessionBanner("La sala ya tiene dos jugadores activos.", "warning");
      return;
    }

    prepararSesion(slot, nombre, codigo);

    const payload = {
      [slot]: { id: clientId, nombre, isTyping: false, connected: true }
    };

    if (state.estado === "esperando") {
      payload.estado = "eligiendo";
      payload.escritor = state.escritor || "jugador1";
    }

    gameRef.update(payload);
    dom.codigoJuego.textContent = `Código de la sala: ${codigo}`;
    setSessionBanner(`Te uniste como ${slot === "jugador1" ? "jugador 1" : "jugador 2"}.`, "success");
    registrarPresencia(slot);
    escucharJuego();
  });
});

dom.enviarBtn.addEventListener("click", () => {
  const texto = dom.mensajeInput.value.trim();
  if (!texto || !gameRef || !jugadorId) return;

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
  if (!gameRef || !jugadorId) return;
  playSound("messageSound");
  gameRef.child("mensajes").push({
    autor: jugadorId,
    texto: "✨",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
});

dom.mensajeInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    dom.enviarBtn.click();
  }
});

dom.mensajeInput.addEventListener("input", () => {
  if (!gameRef || !jugadorId) return;
  gameRef.child(jugadorId).update({ isTyping: true });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => gameRef.child(jugadorId).update({ isTyping: false }), 2000);
});

dom.cancelReplyBtn.addEventListener("click", cancelReply);
dom.adjuntarBtn.addEventListener("click", abrirSelectorFoto);

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

dom.reactionPopup.querySelectorAll(".reaction-emoji").forEach((emoji) => {
  emoji.addEventListener("click", () => addReaction(emoji.dataset.emoji));
});

document.body.addEventListener("click", (event) => {
  if (!dom.reactionPopup.contains(event.target)) dom.reactionPopup.classList.remove("visible");
});

const cerrarReacciones = () => dom.reactionPopup.classList.remove("visible");
window.addEventListener("scroll", cerrarReacciones, true);
window.addEventListener("resize", cerrarReacciones);

dom.themeToggleBtn.addEventListener("click", () => {
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

dom.instalarBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.instalarBtn.hidden = true;
  setSessionBanner(choice.outcome === "accepted" ? "App instalada en tu dispositivo." : "Instalación cancelada.", "idle");
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dom.instalarBtn.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  dom.instalarBtn.hidden = true;
});

window.addEventListener("offline", () => {
  setSessionBanner("Sin conexión. Reconectando...", "warning");
});

window.addEventListener("online", () => {
  setSessionBanner("Conexión recuperada.", "success");
});

mostrarPanel("waiting");
dom.waitingText.textContent = "Crea una sala o únete con un código para empezar.";
