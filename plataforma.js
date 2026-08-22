const CATALOGO = Array.isArray(window.CATALOGO_JUEGOS) ? window.CATALOGO_JUEGOS : [];
const CATEGORIAS = window.CATEGORIAS_JUEGOS || {};

const ESTADOS = {
  disponible: { texto: "Disponible", orden: 0 },
  "en-desarrollo": { texto: "En desarrollo", orden: 1 },
  proximamente: { texto: "Próximamente", orden: 2 }
};

const THEME_KEY = "tresenraya-theme";

const dom = {
  grid: document.getElementById("gridJuegos"),
  sinResultados: document.getElementById("sinResultados"),
  buscador: document.getElementById("buscadorInput"),
  filtros: Array.from(document.querySelectorAll(".filter-chip")),
  barraCategorias: document.getElementById("barraCategorias"),
  roadmap: document.getElementById("roadmapList"),
  footerCategorias: document.getElementById("footerCategorias"),
  footerAnio: document.getElementById("footerAnio"),
  statDisponibles: document.getElementById("statDisponibles"),
  statProximos: document.getElementById("statProximos"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeColorMeta: document.getElementById("themeColorMeta"),
  instalarBtn: document.getElementById("instalarBtn")
};

let filtroActivo = "todos";
let categoriaActiva = "todas";
let terminoBusqueda = "";
let deferredInstallPrompt = null;

/* ---------- Tema ---------- */
function obtenerTemaInicial() {
  const guardado = localStorage.getItem(THEME_KEY);
  if (guardado === "light" || guardado === "dark") return guardado;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function aplicarTema(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  const esOscuro = theme === "dark";
  dom.themeToggleBtn.textContent = esOscuro ? "☀️ Modo claro" : "🌙 Modo oscuro";
  dom.themeColorMeta.setAttribute("content", esOscuro ? "#20152d" : "#ff4d88");
}

dom.themeToggleBtn.addEventListener("click", () => {
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

aplicarTema(obtenerTemaInicial());

/* ---------- Instalación PWA ---------- */
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dom.instalarBtn.hidden = false;
});

dom.instalarBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  dom.instalarBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  dom.instalarBtn.hidden = true;
});

/* ---------- Utilidades ---------- */
function enlaceAbsoluto(url) {
  return new URL(url, window.location.href).href;
}

function crearBadge(estado) {
  const badge = document.createElement("span");
  badge.className = `badge badge-${estado}`;
  badge.textContent = (ESTADOS[estado] || ESTADOS.proximamente).texto;
  return badge;
}

function categoriasDe(juego) {
  return [juego.categoria, ...(juego.categoriasExtra || [])].filter(Boolean);
}

function nombreCategoria(id) {
  const categoria = CATEGORIAS[id];
  return categoria ? `${categoria.emoji} ${categoria.nombre}` : id;
}

async function compartirJuego(juego, boton) {
  const enlace = enlaceAbsoluto(juego.url);
  const feedback = boton.parentElement.querySelector(".copy-feedback");

  if (navigator.share) {
    try {
      await navigator.share({ title: `${juego.nombre} · Juega Juntos`, url: enlace });
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(enlace);
    if (feedback) {
      feedback.textContent = "¡Enlace copiado!";
      setTimeout(() => { feedback.textContent = ""; }, 2200);
    }
  } catch (error) {
    if (feedback) feedback.textContent = enlace;
  }
}

/* ---------- Tarjetas ---------- */
function crearTarjeta(juego) {
  const card = document.createElement("article");
  card.className = "game-card";
  card.dataset.estado = juego.estado;
  card.style.setProperty("--card-color", juego.color);
  card.style.setProperty("--card-color-2", juego.color2);

  const top = document.createElement("div");
  top.className = "card-top";

  const emoji = document.createElement("div");
  emoji.className = "card-emoji";
  emoji.textContent = juego.emoji;
  emoji.setAttribute("aria-hidden", "true");

  const titulos = document.createElement("div");
  const titulo = document.createElement("h3");
  titulo.className = "card-title";
  titulo.textContent = juego.nombre;
  const subtitulo = document.createElement("p");
  subtitulo.className = "card-subtitle";
  subtitulo.textContent = juego.subtitulo;
  titulos.append(titulo, subtitulo);

  top.append(emoji, titulos, crearBadge(juego.estado));

  const categoriaPrincipal = document.createElement("button");
  categoriaPrincipal.type = "button";
  categoriaPrincipal.className = "card-categoria";
  categoriaPrincipal.textContent = nombreCategoria(juego.categoria);
  categoriaPrincipal.title = `Ver juegos de la categoría ${CATEGORIAS[juego.categoria]?.nombre || juego.categoria}`;
  categoriaPrincipal.addEventListener("click", () => aplicarCategoria(juego.categoria));

  const desc = document.createElement("p");
  desc.className = "card-desc";
  desc.textContent = juego.descripcion;

  const meta = document.createElement("div");
  meta.className = "card-meta";
  [`👥 ${juego.jugadores}`, `⏱️ ${juego.duracion}`, `🎯 ${juego.dificultad}`].forEach((texto) => {
    const span = document.createElement("span");
    span.textContent = texto;
    meta.appendChild(span);
  });

  const tags = document.createElement("div");
  tags.className = "card-tags";
  (juego.etiquetas || []).forEach((etiqueta) => {
    const tag = document.createElement("span");
    tag.className = "card-tag";
    tag.textContent = etiqueta;
    tags.appendChild(tag);
  });

  const acciones = document.createElement("div");
  acciones.className = "card-actions";

  if (juego.estado === "disponible") {
    const jugar = document.createElement("a");
    jugar.className = "primary-btn";
    jugar.href = juego.url;
    jugar.textContent = "▶ Jugar";
    acciones.appendChild(jugar);

    const compartir = document.createElement("button");
    compartir.type = "button";
    compartir.className = "ghost-btn";
    compartir.textContent = "🔗 Compartir";
    compartir.addEventListener("click", () => compartirJuego(juego, compartir));
    acciones.appendChild(compartir);

    const feedback = document.createElement("span");
    feedback.className = "copy-feedback";
    feedback.setAttribute("aria-live", "polite");
    acciones.appendChild(feedback);
  } else {
    const bloqueado = document.createElement("button");
    bloqueado.type = "button";
    bloqueado.className = "ghost-btn";
    bloqueado.disabled = true;
    bloqueado.textContent = juego.estado === "en-desarrollo" ? "🚧 En construcción" : "🔒 Muy pronto";
    acciones.appendChild(bloqueado);
  }

  card.append(top, categoriaPrincipal, desc, tags, meta, acciones);
  return card;
}

function juegosFiltrados() {
  const termino = terminoBusqueda.trim().toLowerCase();

  return CATALOGO
    .filter((juego) => filtroActivo === "todos" || juego.estado === filtroActivo)
    .filter((juego) => categoriaActiva === "todas" || categoriasDe(juego).includes(categoriaActiva))
    .filter((juego) => {
      if (!termino) return true;
      const texto = [
        juego.nombre,
        juego.subtitulo,
        juego.descripcion,
        ...categoriasDe(juego).map(nombreCategoria),
        ...(juego.etiquetas || [])
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(termino);
    })
    .sort((a, b) => {
      const ordenA = (ESTADOS[a.estado] || ESTADOS.proximamente).orden;
      const ordenB = (ESTADOS[b.estado] || ESTADOS.proximamente).orden;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return Number(b.destacado) - Number(a.destacado);
    });
}

function renderCatalogo() {
  const juegos = juegosFiltrados();
  dom.grid.replaceChildren(...juegos.map(crearTarjeta));
  dom.sinResultados.hidden = juegos.length > 0;
}

function contarPorCategoria(id) {
  return CATALOGO.filter((juego) => categoriasDe(juego).includes(id)).length;
}

function aplicarCategoria(id) {
  categoriaActiva = id;
  Array.from(dom.barraCategorias.children).forEach((boton) => {
    const activo = boton.dataset.categoria === id;
    boton.classList.toggle("is-active", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
  renderCatalogo();
  dom.grid.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function crearBotonCategoria(id, etiqueta, total) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "category-chip";
  boton.dataset.categoria = id;
  boton.setAttribute("aria-pressed", String(id === categoriaActiva));
  boton.classList.toggle("is-active", id === categoriaActiva);

  const texto = document.createElement("span");
  texto.textContent = etiqueta;
  const contador = document.createElement("small");
  contador.textContent = String(total);

  boton.append(texto, contador);
  boton.addEventListener("click", () => aplicarCategoria(id));
  return boton;
}

function renderCategorias() {
  const botones = [crearBotonCategoria("todas", "✨ Todas", CATALOGO.length)];

  Object.entries(CATEGORIAS).forEach(([id, categoria]) => {
    const total = contarPorCategoria(id);
    if (total === 0) return;
    botones.push(crearBotonCategoria(id, `${categoria.emoji} ${categoria.nombre}`, total));
  });

  dom.barraCategorias.replaceChildren(...botones);
}

function renderRoadmap() {
  const pendientes = CATALOGO.filter((juego) => juego.estado !== "disponible");

  dom.roadmap.replaceChildren(...pendientes.map((juego) => {
    const item = document.createElement("li");

    const emoji = document.createElement("span");
    emoji.className = "roadmap-emoji";
    emoji.textContent = juego.emoji;
    emoji.setAttribute("aria-hidden", "true");

    const info = document.createElement("div");
    const nombre = document.createElement("strong");
    nombre.textContent = juego.nombre;
    const detalle = document.createElement("small");
    detalle.textContent = `${juego.subtitulo} · ${nombreCategoria(juego.categoria)}`;
    info.append(nombre, detalle);

    item.append(emoji, info, crearBadge(juego.estado));
    return item;
  }));
}

function renderEstadisticas() {
  const disponibles = CATALOGO.filter((juego) => juego.estado === "disponible").length;
  dom.statDisponibles.textContent = String(disponibles);
  dom.statProximos.textContent = String(CATALOGO.length - disponibles);
}

function renderFooter() {
  dom.footerAnio.textContent = String(new Date().getFullYear());

  const items = Object.entries(CATEGORIAS)
    .filter(([id]) => contarPorCategoria(id) > 0)
    .map(([id, categoria]) => {
      const li = document.createElement("li");
      const enlace = document.createElement("a");
      enlace.href = "#catalogo";
      enlace.textContent = `${categoria.emoji} ${categoria.nombre}`;
      enlace.addEventListener("click", () => aplicarCategoria(id));
      li.appendChild(enlace);
      return li;
    });

  dom.footerCategorias.replaceChildren(...items);
}

dom.buscador.addEventListener("input", (event) => {
  terminoBusqueda = event.target.value;
  renderCatalogo();
});

dom.filtros.forEach((chip) => {
  chip.addEventListener("click", () => {
    filtroActivo = chip.dataset.filtro;
    dom.filtros.forEach((otro) => otro.classList.toggle("is-active", otro === chip));
    renderCatalogo();
  });
});

renderCategorias();
renderCatalogo();
renderRoadmap();
renderEstadisticas();
renderFooter();
