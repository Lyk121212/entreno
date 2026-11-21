// entreno v1.1.1
// Rutina inicial (full body A/B). Solo se usa hasta la primera sincronización con la hoja.
const E = (id, nombre, grupo, series, repMin, repMax, incremento, notas = '') => ({ id, nombre, grupo, series, repMin, repMax, incremento, activo: true, notas });
export const SEED = {
  ejercicios: [
    E('prensa', 'Prensa de piernas', 'pierna', 3, 10, 12, 5, 'No despegues la zona lumbar del respaldo'),
    E('press-pecho', 'Press de pecho en máquina', 'empuje', 3, 8, 12, 2.5),
    E('jalon', 'Jalón al pecho', 'tirón', 3, 8, 12, 2.5, 'Tira hacia el pecho, nunca por detrás de la nuca'),
    E('curl-femoral', 'Curl femoral', 'pierna', 3, 10, 15, 2.5),
    E('elevaciones', 'Elevaciones laterales', 'empuje', 3, 12, 15, 1, 'Hombros lejos de las orejas para no cargar el cuello'),
    E('pallof', 'Pallof press en polea', 'core', 3, 10, 12, 2.5, 'Repeticiones por lado; core firme, sin girar'),
    E('hip-thrust', 'Hip thrust', 'pierna', 3, 8, 12, 5, 'Aprieta glúteo arriba sin arquear la zona lumbar'),
    E('press-inclinado', 'Press inclinado con mancuernas', 'empuje', 3, 8, 12, 2, 'Peso de cada mancuerna'),
    E('remo-apoyo', 'Remo con apoyo en el pecho', 'tirón', 3, 8, 12, 2.5, 'Pecho apoyado para descargar los lumbares'),
    E('extension-cuad', 'Extensión de cuádriceps', 'pierna', 3, 10, 15, 2.5),
    E('face-pull', 'Face pull en polea', 'tirón', 3, 12, 15, 2.5),
    E('triceps-polea', 'Tríceps en polea', 'empuje', 2, 10, 15, 2.5),
    E('curl-biceps', 'Curl de bíceps con mancuernas', 'tirón', 2, 10, 15, 2, 'Peso de cada mancuerna'),
  ],
  plantillas: [
    { id: 'A', nombre: 'Full body A', ejercicios: 'prensa, press-pecho, jalon, curl-femoral, elevaciones, pallof' },
    { id: 'B', nombre: 'Full body B', ejercicios: 'hip-thrust, press-inclinado, remo-apoyo, extension-cuad, face-pull, triceps-polea, curl-biceps' },
  ],
};
