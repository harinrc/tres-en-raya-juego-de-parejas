const firebaseConfig = {
  apiKey: "AIzaSyAf65_YB-vDHDeVf6dUP6vMKLp_ctSy83A",
  authDomain: "x0-para-ana-y-harin.firebaseapp.com",
  databaseURL: "https://x0-para-ana-y-harin-default-rtdb.firebaseio.com",
  projectId: "x0-para-ana-y-harin",
  storageBucket: "x0-para-ana-y-harin.appspot.com",
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

const dom = {
  tablero: document.getElementById("tablero"),
  estadoJuego: document.getElementById("estadoJuego"),
  codigoJuego: document.getElementById("codigoJuego"),
  crearJuegoBtn: document.getElementById("crearJuegoBtn"),
  unirseBtn: document.getElementById("unirseBtn"),
  reiniciarBtn: document.getElementById("reiniciarBtn"),
  mensajeInput: document.getElementById("mensajeInput"),
  enviarBtn: document.getElementById("enviarBtn"),
  chatBox: document.getElementById("chatBox"),
  corazonBtn: document.getElementById("corazonBtn"),
  modal: document.getElementById("modal"),
  modalMensaje: document.getElementById("modal-mensaje"),
  nombreInput: document.getElementById("nombreInput"),
  marcador: document.getElementById("marcador"),
  typingIndicator: document.getElementById("typingIndicator"),
  replyPreview: document.getElementById("replyPreview"),
  replyPreviewAuthor: document.getElementById("replyPreviewAuthor"),
  replyPreviewText: document.getElementById("replyPreviewText"),
  reactionPopup: document.getElementById("reactionPopup"),
  adjuntarBtn: document.getElementById("adjuntarBtn"),
  galeriaInput: document.getElementById("galeriaInput"),
  camaraInput: document.getElementById("camaraInput")
};

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
  const otroJugadorId = jugadorId === "jugador1" ? "jugador2" : "jugador1";
  if (estadoJuegoActual[otroJugadorId]?.isTyping) {
    dom.typingIndicator.textContent = `${estadoJuegoActual[otroJugadorId].nombre} está escribiendo...`;
  } else {
    dom.typingIndicator.textContent = "";
  }
}

function escucharJuego() {
  if (!gameRef) return;
  gameRef.off("value");
  gameRef.off("child_added");
  gameRef.off("child_changed");

  gameRef.on("value", (snap) => {
    const state = snap.val();
    if (!state) return;
    estadoJuegoActual = state;
    actualizarTableroUI();
    actualizarMarcadorUI();
    actualizarTypingIndicator();
    if (state.estado === "finalizado") {
      mostrarResultado(state.ganador);
    } else if (state.estado === "jugando") {
      ocultarResultado();
      actualizarEstadoTurno();
    } else {
      mostrarEstado("Esperando que se una tu amorcito... 🥰");
    }
  });

  const mensajesRef = gameRef.child("mensajes");
  mensajesRef.on("child_added", (snap) => agregarMensajeAlChat(snap.key, snap.val()));
  mensajesRef.on("child_changed", (snap) => actualizarMensajeEnChat(snap.key, snap.val()));
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

  if (msg.tipo === "imagen") {
    const img = document.createElement("img");
    img.src = msg.imagenUrl;
    img.alt = "foto enviada";
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
  if (!file || !file.type.startsWith("image/")) {
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
  gameRef.update({
    tablero: Array(9).fill(""),
    turno: "jugador1",
    estado: "jugando",
    ganador: null,
    lineaGanadora: null
  });
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
  codigoJuego = Math.random().toString(36).substr(2, 5);
  jugadorId = "jugador1";
  gameRef = db.ref(`juegos/${codigoJuego}`);
  gameRef.set({
    tablero: Array(9).fill(""),
    turno: "jugador1",
    jugador1: { nombre, simbolo: "❤️", isTyping: false },
    jugador2: null,
    estado: "esperando",
    ganador: null,
    lineaGanadora: null,
    marcador: { jugador1: 0, jugador2: 0 }
  });
  dom.codigoJuego.textContent = `Código del juego: ${codigoJuego}`;
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
  jugadorId = "jugador2";
  gameRef = db.ref(`juegos/${codigoJuego}`);
  gameRef.update({
    jugador2: { nombre, simbolo: "💙", isTyping: false },
    estado: "jugando"
  });
  dom.codigoJuego.textContent = `Código del juego: ${codigoJuego}`;
  escucharJuego();
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
document.body.addEventListener("click", (e) => {
  if (!dom.reactionPopup.contains(e.target)) dom.reactionPopup.classList.remove("visible");
});
