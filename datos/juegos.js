/**
 * Catálogo central de la plataforma.
 * Para agregar un juego nuevo: crea la carpeta juegos/<slug>/ y añade aquí su ficha.
 * El enlace único de cada juego es siempre  /juegos/<slug>/
 */

/** Categorías de la plataforma. La clave es el id que cada juego usa en su campo "categoria". */
window.CATEGORIAS_JUEGOS = {
  parejas: { nombre: "Parejas", emoji: "💑" },
  amigos: { nombre: "Amigos", emoji: "👫" },
  familia: { nombre: "Familia", emoji: "👨‍👩‍👧" },
  clasicos: { nombre: "Clásicos", emoji: "🎯" },
  ingenio: { nombre: "Ingenio", emoji: "🧠" },
  fiesta: { nombre: "Fiesta", emoji: "🎉" }
};

window.CATALOGO_JUEGOS = [
  {
    slug: "tres-en-raya",
    nombre: "Tres en raya",
    subtitulo: "X y 0 para dos corazones",
    emoji: "❤️",
    descripcion:
      "El clásico X0 en tiempo real con código de sala privado, chat, fotos, reacciones y modo oscuro. Pensado para jugar en pareja desde cualquier lugar.",
    categoria: "parejas",
    categoriasExtra: ["clasicos"],
    etiquetas: ["Clásico", "Chat en vivo", "PWA"],
    jugadores: "2 jugadores",
    duracion: "2-5 min",
    dificultad: "Fácil",
    estado: "disponible",
    destacado: true,
    color: "#ff4d88",
    color2: "#ff8fb1",
    url: "juegos/tres-en-raya/index.html"
  },
  {
    slug: "ahorcado",
    nombre: "Ahorcado",
    subtitulo: "Adivina la palabra secreta",
    emoji: "🔤",
    descripcion:
      "Uno escribe una palabra o frase secreta y el otro intenta adivinarla letra por letra antes de quedarse sin intentos. Con pistas, categorías temáticas y chat.",
    categoria: "clasicos",
    categoriasExtra: ["amigos", "familia", "ingenio"],
    etiquetas: ["Palabras", "Por turnos", "Próximo"],
    jugadores: "2 jugadores",
    duracion: "5-10 min",
    dificultad: "Media",
    estado: "en-desarrollo",
    destacado: false,
    color: "#7b5cff",
    color2: "#b39dff",
    url: "juegos/ahorcado/index.html"
  },
  {
    slug: "verdad-o-reto",
    nombre: "Verdad o reto",
    subtitulo: "Preguntas y retos para el grupo",
    emoji: "🎲",
    descripcion:
      "Ruleta de verdades y retos con niveles de intensidad, cartas personalizadas y modo a distancia. Configura el tono según con quién juegues.",
    categoria: "fiesta",
    categoriasExtra: ["amigos", "parejas"],
    etiquetas: ["Fiesta", "Cartas"],
    jugadores: "2 o más jugadores",
    duracion: "10-20 min",
    dificultad: "Fácil",
    estado: "proximamente",
    destacado: false,
    color: "#ff8a3d",
    color2: "#ffc48a",
    url: "juegos/verdad-o-reto/index.html"
  },
  {
    slug: "memorama",
    nombre: "Memorama",
    subtitulo: "Encuentra los pares",
    emoji: "🧠",
    descripcion:
      "Voltea cartas y encuentra parejas contra el reloj. Puedes usar mazos temáticos o subir tus propias fotos.",
    categoria: "ingenio",
    categoriasExtra: ["familia", "clasicos"],
    etiquetas: ["Memoria", "Fotos"],
    jugadores: "1-2 jugadores",
    duracion: "5 min",
    dificultad: "Media",
    estado: "proximamente",
    destacado: false,
    color: "#2bb3a3",
    color2: "#8fe0d6",
    url: "juegos/memorama/index.html"
  },
  {
    slug: "batalla-naval",
    nombre: "Batalla naval",
    subtitulo: "Hunde la flota rival",
    emoji: "🚢",
    descripcion:
      "Coloca tus barcos en secreto y ataca coordenada por coordenada en salas privadas en tiempo real.",
    categoria: "clasicos",
    categoriasExtra: ["amigos", "ingenio"],
    etiquetas: ["Estrategia", "Tiempo real"],
    jugadores: "2 jugadores",
    duracion: "10-15 min",
    dificultad: "Media",
    estado: "proximamente",
    destacado: false,
    color: "#3d7bff",
    color2: "#9dc0ff",
    url: "juegos/batalla-naval/index.html"
  }
];
