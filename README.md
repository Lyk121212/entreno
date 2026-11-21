# Entreno

Libreta de entreno personal: pesos, repeticiones, carreras y otros deportes, sin bloat. App de recuento y agenda, no de objetivos. PWA instalable (Android), funciona sin conexión y se sincroniza con una hoja de Google que Claude lee y escribe.

- **App:** HTML/JS sin framework, alojada en GitHub Pages. Datos en el móvil (IndexedDB) y cola de cambios pendientes.
- **Sincronización:** `apps-script/Code.gs`, implementado como aplicación web en la hoja de Google. La app sube los cambios por POST y baja la hoja entera al abrirse.
- **Claude:** lee y escribe la hoja con el conector de Google Sheets (plan semanal, revisiones, rutina).

## Pestañas de la hoja

| Pestaña | Quién escribe | Columnas |
|---|---|---|
| ejercicios | App y Claude | id, nombre, grupo, musculo, modo (kg/corporal/tiempo), series, repMin, repMax, incremento, activo, notas |
| plantillas | App y Claude | id, nombre, ejercicios (ids separados por comas, en orden) |
| plan_semanal | Claude | id, semana (`2026-W48`), fecha (`AAAA-MM-DD`), hora, tipo (gimnasio/carrera/movilidad/deporte), plantilla, detalle, nota (de la semana). La app no muestra objetivos |
| revisiones | Claude | id, semana, resumen, ajustes, plan_siguiente |
| sesiones | App | id, fecha, plantilla, nombre, nota, creado |
| series | App | id, sesion, fecha, ejercicio, nombre, serie, peso, reps, obj_peso, obj_reps, nota |
| carreras | App | id, fecha, km, tiempo, segundos, ritmo, tipo (suave/larga/series/test), sensacion, nota, creado |
| movilidad | App | id, fecha, creado |
| deportes | App | id, fecha, deporte (texto libre: Pádel, Surf…), minutos, sensacion, nota, creado |

Todo se guarda como texto; los decimales llevan punto (`2.5`). Se pueden añadir columnas y pestañas: la app ignora lo que no conoce y no lo borra, y el Apps Script crea solo las pestañas nuevas (no hace falta volver a desplegarlo).

Los ejercicios de una rutina pueden ser ids del catálogo (`js/catalogo.js`, 84 ejercicios con fotos) aunque no tengan fila en `ejercicios`: la app usa los valores del catálogo. Lo que se escriba en la hoja manda sobre el catálogo.

Fotos de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (dominio público), convertidas a webp con `scripts/catalogo.py`.

## Desarrollo

```bash
npm install          # solo para las pruebas (playwright-core)
npm test             # lógica de progresión + Code.gs en un simulador de Sheets
node tests/e2e.mjs   # la app real en Chrome contra el simulador (necesita google-chrome)
```

Para publicar una versión: `python3 scripts/version.py X.Y.Z` (marca todos los archivos), pruebas, commit y push. El service worker solo instala la versión nueva cuando GitHub sirve **todos** los archivos con la misma marca, así que un despliegue a medias nunca mezcla versiones en el móvil.
