# Entreno

Libreta de entreno personal: pesos, repeticiones y carreras, sin bloat. PWA instalable (Android), funciona sin conexión y se sincroniza con una hoja de Google que Claude lee y escribe.

- **App:** HTML/JS sin framework, alojada en GitHub Pages. Datos en el móvil (IndexedDB) y cola de cambios pendientes.
- **Sincronización:** `apps-script/Code.gs`, implementado como aplicación web en la hoja de Google. La app sube los cambios por POST y baja la hoja entera al abrirse.
- **Claude:** lee y escribe la hoja con el conector de Google Sheets (plan semanal, revisiones, rutina).

## Pestañas de la hoja

| Pestaña | Quién escribe | Columnas |
|---|---|---|
| ejercicios | Claude (y la app al editar rangos) | id, nombre, grupo, series, repMin, repMax, incremento, activo, notas |
| plantillas | Claude | id, nombre, ejercicios (ids separados por comas, en orden) |
| plan_semanal | Claude | id, semana (`2026-W48`), fecha (`AAAA-MM-DD`), hora, tipo (gimnasio/carrera/movilidad), plantilla, detalle, objetivo (sesiones de la semana), nota |
| revisiones | Claude | id, semana, resumen, ajustes, plan_siguiente |
| sesiones | App | id, fecha, plantilla, nombre, nota, creado |
| series | App | id, sesion, fecha, ejercicio, nombre, serie, peso, reps, obj_peso, obj_reps, nota |
| carreras | App | id, fecha, km, tiempo, segundos, ritmo, tipo (suave/larga/series/test), sensacion, nota, creado |
| movilidad | App | id, fecha, creado |

Todo se guarda como texto; los decimales llevan punto (`2.5`). Se pueden añadir columnas: la app ignora las que no conoce y no las borra.

## Desarrollo

```bash
npm install          # solo para las pruebas (playwright-core)
npm test             # lógica de progresión + Code.gs en un simulador de Sheets
node tests/e2e.mjs   # la app real en Chrome contra el simulador (necesita google-chrome)
```

Al cambiar archivos de la app, sube `VERSION` en `sw.js` y `APP_VERSION` en `index.html` para que el móvil coja la versión nueva.
