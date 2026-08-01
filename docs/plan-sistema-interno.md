# Plan — Sistema interno LC Traslados Especiales

Documento de requisitos acordados. **Estado:** Fases 1–8 + multi-rol · rediseño Administración en curso (Etapa 5).  
Última actualización: 29 jul 2026.

---

## Objetivo general

Ampliar el proyecto actual (landing) con un **sistema interno** con autenticación.  
Se necesita un **backend** para soportar usuarios, roles, áreas, grillas, etc.

### Landing
- Se **quita** la sección de Contacto de la página pública.
- **Email:** por ahora se **prescinde** de esa lógica (no prioritario).
- **WhatsApp:** se integra el envío de **grillas** al flujo operativo (ver sección WhatsApp).

### Acceso
- En la navbar se agrega el botón **"Iniciar sesión"**.
- Según el usuario logueado, se redirige a **su panel correspondiente**.

---

## Jerarquía de roles

1. **Admin** (arriba de todos) — catálogos: usuarios, áreas, destinos, transportes, pasajeros, choferes
2. **Administración** (enum `ADMINISTRACION`) — asignaciones y grillas por área
3. **Celadora** / **Chofer** (operativos; ambos con panel)

---

## Rediseño Administración + Maps (en curso)

### Etapa 1 (lista)
- Renombre completo Coordinadora → Administración (rol `ADMINISTRACION`, panel `/panel/administracion`, APIs `/api/administracion`).
- Áreas y destinos: solo Admin crea/edita/elimina.
- Administración elige área y asigna recursos.
- Shell: toggle de paneles multi-rol; tablero Área con pool acordeón + pestañas de área (DnD).
- Prestador: chofer marcado (sin rendir combustible).

### Etapa 2 (lista)
- Grilla con **nombre** (crear / listar / borrar).
- Pasajero con **varios destinos**.
- **Punto de encuentro** de celadora (crear + guardar frecuente por celadora).

### Etapa 3 (lista)
- Tablero drag-and-drop: Recursos (izq) ↔ grilla (der).
- Encabezado: 1 vehículo, 1 chofer, 1 celadora (opcional) + punto de encuentro.
- Paradas por arrastre de pasajeros/destinos (sin “Crear fila”).
- Itinerarios: Ingresos, Salidas, Adaptación, Especial.

### Etapa 4 (lista)
- Paneles Celadora / Chofer: nombre de grilla + punto de encuentro visibles.
- Compatibilidad con asistencias, reloj e informe (sin Maps).

### Etapa 5 (en implementación)
- Mapa bajo la grilla con **OpenStreetMap + OSRM** (gratis, sin cuenta de pago).
- Geocode automático + **coordenadas** guardadas (dirección de texto intacta para el chofer).
- Pins arrastrables / “Ubicar en mapa”; sugerencia de aplicar el pin también a Maps/Waze.
- Optimizar recorrido / Descartar optimización.
- **Sugerir horarios** hacia atrás desde destinos con hora fija (15 min; no pisa horarios ya cargados).
- Google Maps Platform queda como opción futura si el dueño prefiere pagar el servicio.
- Pendiente opcional: retorno a base.

### Etapas siguientes
- (refinar) horarios sugeridos hacia atrás desde destinos fijos; retorno a base opcional.

---

## Entidades

| Entidad | Tipo | Notas |
|---------|------|--------|
| Admin | Persona / rol | Gestión global |
| Administración | Persona / rol | Gestión de áreas y grillas |
| Celadora | Persona / rol | Panel: recorrido pasajeros + asistencia |
| Chofer | Persona / rol | Panel: manejo del vehículo, rutas, celadora opcional |
| Transporte | Recurso | Vehículo; puede modificarse |
| Pasajero | Persona | Nombre y dirección |
| Área | Organización | Definida por la Administración |
| Destino | Dentro de un área | Nombre y domicilio |
| Grilla | Hoja de ruta | Itinerario diario; asignada a celadora y chofer |
| Publicación | Comunicación | Creada por el admin |

Estados comunes (donde aplique): **activo** / **inactivo**.

---

## Admin — capacidades

### Usuarios
- **Solo el Admin** puede crear usuarios (no hay registro público).
- Desde su panel puede:
  - **Crear** usuario: nombre de usuario + contraseña.
  - **Asignar uno o más roles** al usuario: Administración, Celadora y/o Chofer (cualquier combinación).
  - **Eliminar** usuario (no Admins).
- El rol **Admin** no se asigna desde el panel: solo existen por seed (Hori y Gladis).
- Las credenciales son **únicas**.
- Quien ingresa lo hace porque el Admin ya le dio usuario, contraseña y rol(es).
- Usuarios con varios roles ven un **selector de paneles** y pueden cambiar entre ellos.
- Usuarios seed iniciales (solo desarrollo): ver sección correspondiente.

### Transportes
- Agregar transportes:
  - Nombre
  - Tipo de transporte
  - Capacidad de pasajeros (**opcional**)

### Pasajeros
- Agregar pasajeros:
  - Nombre
  - Dirección

### Choferes
- Crear choferes.
- Asignarles un **vehículo (Transporte)**.
- El chofer **tiene panel propio**.

### Gráficas (totales / agregados)
El Admin visualiza el **total de todo**, por ejemplo:
- Cuántos chicos **asistieron** en total
- Asistencias **por área**
- Asistencias **por destino**
- **Duración** del recorrido del **chofer** y de la **celadora**
- **Promedio** de asistencias por pasajero
- Pasajeros **más frecuentes** (mayor asistencia)

### Publicaciones
- Crear publicaciones con **duración** definida por el admin.
- Destinatarios **manuales** (checkboxes): Administración, celadoras y/o choferes.
- Aparecen en el panel de los roles seleccionados mientras estén vigentes.

---

## Referencia real de grilla (Excel actual)

Hoy la grilla se arma a mano en Excel. Ejemplo observado:

**Título:** `ITINERARIO: INGRESOS "ARCOIRIS DE AMOR"`

**Cabecera**
- Ruta / nombre del transporte (ej. ARCOIRIS DE AMOR)
- Fecha
- Horarios de ingreso al destino (ej. 8:30 / 9:00 / 9:30)
- Mensaje / nota del día (opcional)
- Responsables: chofer + celadora
- Tipo (ej. MASTER)

**Filas**
| Hora | Parada / dirección | Acción |
|------|--------------------|--------|
| HH:mm | PARADA + domicilio completo (calle, número, localidad) o destino institucional | `sube` / `baja` + nombre(s) |

Notas del ejemplo:
- Puede haber parada **BASE** al inicio.
- Destino institucional destacado (ej. CETRINET) donde “bajan los pasajeros”.
- Pueden subir/bajar personal (chofer/celadora) y pasajeros.
- Direcciones con calle + número + localidad → ideales para Maps/Waze.

### Flujo WhatsApp actual (manual)
1. Arman la grilla en Excel.
2. Sacan una **captura**.
3. La envían al **grupo de WhatsApp** (celadoras + choferes).

### Flujo WhatsApp deseado (sistema) — **Opción A (confirmada)**
- La Administración crea la grilla en el sistema.
- El sistema genera **imagen o PDF** de la grilla.
- Se abre WhatsApp para **compartir** al grupo (similar al flujo actual de captura, pero desde la app).
- No se usa API WhatsApp Business en esta etapa.

---

## Stack técnico (confirmado)

| Capa | Tecnología |
|------|------------|
| Frontend / App | **Next.js** (mismo repo) |
| API | **Next.js API Routes / Route Handlers** |
| Base de datos | **PostgreSQL** |
| ORM | **Prisma** |
| Auth | Sesión + roles (detalle en implementación) |
| WhatsApp | Opción A: generar imagen/PDF + compartir |
| Email | Prescindido por ahora |

---

## Plan de acción por fases

### Fase 1 — Acceso y estructura base
- Quitar sección Contacto de la landing (y limpiar nav/footer).
- Botón **"Iniciar sesión"** en navbar.
- Setup **Prisma + PostgreSQL**.
- Auth básica (login / logout / sesión).
- Redirección por rol a panel vacío (Admin, Administración, Celadora, Chofer).
- Seed: Hori, Fernanda, Camila, Seba.

### Fase 2 — Panel Admin: usuarios
- Crear / eliminar usuarios.
- Asignar entidad (Administración, celadora, chofer).
- Credenciales únicas.

### Fase 3 — Admin: catálogos
- Transportes (nombre, tipo, capacidad opcional, activo/inactivo).
- Pasajeros (nombre, dirección, activo/inactivo).
- Choferes + asignación de vehículo.

### Fase 4 — Administración: áreas y asignaciones
- Áreas (seed: San Miguel, Villa de Mayo).
- Destinos (nombre + domicilio).
- Asignar celadoras, transportes y pasajeros a áreas.
- Asignar celadoras a transportes.

### Fase 5 — Grillas
- Crear grilla (ingreso/salida, transporte, fecha, responsables, con/sin celadora).
- Filas: hora, dirección, pasajero, sube/baja.
- UI inspirada en el Excel real (Arcoíris de Amor).
- Enviar grilla por WhatsApp (imagen/PDF + compartir).

### Fase 6 — Paneles operativos
- **Celadora:** iniciar/fin (subida pasajeros), asistencia, informe; pestañas Principal (grillas nuevas) / Historial (completadas).
- **Chofer:** inicio/fin (manejo), Maps/Waze, asistencia si sin celadora, informe; Principal / Historial / **Vehículo asignado** (detalle + novedades visibles para Admin y Administración).

### Fase 7 — Admin: métricas y publicaciones
- **Informe:** por celadora y por chofer (historial de informes, duración por ruta, destinos/asistencia o combustible en barras). Filtro por fechas. Admin + Administración.
- Apartado futuro de **Pasajeros** (métricas propias) pendiente.
- **Publicaciones:** avisos con vigencia; el Admin elige destinatarios (Administración, celadoras y/o choferes).

### Fase 8 — Respaldo de historiales
- Pestaña **Respaldo** (Admin + Administración): filtros por fechas / área / transporte / pasajero.
- Descargar CSV (Excel) de grillas y de asistencias.
- Imprimir / Guardar PDF (ventana de impresión del navegador) con itinerario, asistencias, tiempos e informes.

---

## Administración — capacidades

### Grillas / itinerario
- Al elegir **Ingresos** o **Salidas**, las acciones **sube/baja** se invierten (pasajero ↔ destino).
- En el área, cada pasajero puede tener un **destino habitual**; la fila de destino lista quiénes bajan/suben.
- **Salidas desde Ingresos:** botón para armar la grilla con quienes **asistieron** ese día; transporte y celadora quedan editables; se pueden agregar filas extra.

### Áreas
- Gestionar “Áreas” separadas por **nombre** (definido por Administración).
- **Seed inicial:** crear 2 áreas:
  - San Miguel
  - Villa de Mayo

### Destinos (dentro de un área)
- Nombre
- Domicilio

### Asignaciones que hace la Administración
- Asignar **celadoras** a un Área.
- Asignar **transportes** a un Área.
- Asignar **celadoras a transportes**.
- Asignar **pasajeros** a un Área.
- Crear **grillas** y asignarlas a **celadora** y **chofer**.
- Indicar en cada grilla si el recorrido es **con celadora** o **sin celadora**.

### Grillas (hoja de ruta)

Cada grilla se compone así:

**Título**
```
Itinerario: {ingreso | salida} {nombre del transporte} {fecha}
```

**Responsables**
- Chofer y celadora (celadora puede ser opcional en el recorrido real; ver panel chofer)
- Tipo de transporte

**Listado (filas)**
| Campo | Descripción |
|-------|-------------|
| Horario de llegada estimada | — |
| Dirección | Lo más precisa posible (para Maps/Waze) |
| Nombre del pasajero / detalle | También puede ser destino (ej. pasajeros → Cetrinet) |
| Estado | `sube` / `baja` / `trasbordo` |
| Trasbordo hacia | Si es trasbordo: nombre del otro vehículo |

**Tipos de parada al crear grilla**
- **Pasajero:** sube/baja en domicilio
- **Destino del área:** ej. Cetrinet (bajan pasajeros y el recorrido puede seguir)
- **Trasbordo:** el pasajero pasa a otro vehículo para optimizar rutas

---

## Celadora — capacidades

### Asignación
- Se le asigna una **grilla** creada por la Administración.

### Control del recorrido
- **"Iniciar Recorrido"** = momento en que **comienzan a subir los pasajeros**.
- **"Finalizar Recorrido"** = fin de esa etapa operativa.
- Sirve para medir la duración del tramo de pasajeros.

### Grilla en el panel
- Ve la grilla asignada.
- Por cada pasajero informa la situación:
  - **Asistió**
  - **Canceló** (opcional: texto breve con el motivo)
  - **No se presentó**

### Informe post-recorrido
- Al finalizar, completa **observaciones adicionales**.
- Visible **solo para Admin y Administración**.

---

## Chofer — capacidades

### Asignación
- Se le asigna una **grilla** creada por la Administración.

### Celadora opcional
- La **Administración** indica en la grilla si el recorrido es **con o sin celadora**.
- Hay recorridos que el chofer puede hacer **sin celadora**.
- Si el recorrido es **sin celadora**, el chofer debe marcar por cada pasajero:
  - **Asistió**
  - **Canceló** (opcional: texto breve con el motivo)
  - **No se presentó**

### Control del recorrido (distinto al de la celadora)
- **"Inicio"** = momento en que **comienza a manejar el vehículo**.
- **"Fin"** = cuando termina de manejar / cierra el recorrido de conducción.
- **Aclaración de negocio:**
  - Inicio **chofer** ≠ Inicio **celadora**.
  - Chofer = arranque del vehículo.
  - Celadora = arranque de subida de pasajeros.

### Grilla / direcciones
- Puede interactuar con las **direcciones** del listado.
- Ideal: dirección lo más precisa posible.
- Al seleccionar una dirección, el usuario **elige** abrir **Google Maps** o **Waze**.
- Para Waze hace falta tener la app instalada en el dispositivo.

### Informe post-recorrido
- Al finalizar, también completa el **informe de observaciones** (igual que la celadora).
- Visible **solo para Admin y Administración**.
- Al cerrar el informe, la grilla pasa de **Principal** a **Historial** (solo lectura).

### Vehículo asignado
- Detalle del transporte asignado por Admin.
- El chofer puede **notificar novedades** del vehículo; Admin y Administración las ven en la pestaña **Novedades**.

---

## Usuarios seed (desarrollo / pruebas)

> Solo para entorno de desarrollo/pruebas. En producción el Admin crea y gestiona todos los usuarios operativos. Los Admin no se crean desde el panel.

| Roles | Usuario | Contraseña |
|-------|---------|------------|
| Admin | Hori | 1234 |
| Admin | Gladis | 1234 |
| Administración | Fernanda | 1234 |
| Celadora | Camila | 1234 |
| Chofer | Seba | 1234 |

### Reglas de alta / acceso
- No hay auto-registro ni alta pública.
- **Admin** crea usuario + contraseña desde su panel.
- **Admin** asigna **uno o más roles** (Administración, Celadora, Chofer). Ejemplo: Celadora + Administración (responsable de área).
- **Admin** no se asigna ni se elimina desde el panel (solo Hori y Gladis por seed).
- Credenciales **únicas** por persona.
- El acceso implica que el Admin ya entregó las credenciales y el/los rol(es) a esa persona.
- Multi-rol: un solo login; selector “Ir a: …” entre paneles permitidos.

---

## Aclaración temporal: dos relojes por recorrido

| Quién | Inicio significa | Fin significa |
|-------|------------------|---------------|
| Chofer | Empieza a manejar el vehículo | Termina el manejo / recorrido de conducción |
| Celadora | Empiezan a subir los pasajeros | Termina el tramo de pasajeros / su recorrido operativo |

Permite medir tiempos distintos (conducción vs. operación con pasajeros).

---

## Flujo resumido (hasta ahora)

1. **Admin** crea usuarios, transportes, pasajeros y choferes (con vehículo).
2. **Administración** organiza Áreas, asignaciones y crea Grillas.
3. En la grilla, la **Administración** marca si va **con o sin celadora**.
4. Grilla se asigna a **celadora** (si aplica) y **chofer**.
5. **Chofer** inicia manejo, usa Maps/Waze en direcciones; si no hay celadora, marca asistencias; finaliza e informa.
6. **Celadora** (si hay) inicia subida de pasajeros, marca asistencias, finaliza e informa.
7. Admin y Administración ven informes y métricas de tiempos.

---

## Pendiente de definir

- [x] Dudas chofer (asistencia sin celadora, Maps/Waze, quién define con/sin celadora)
- [x] Usuarios seed de acceso a paneles
- [x] Cómo se crean/eliminan usuarios (solo Admin; sin registro público; credenciales únicas)
- [x] Gráficas Admin (totales, por área/destino, tiempos, promedios, frecuencia)
- [x] Email: prescindir por ahora
- [x] WhatsApp: Opción A (imagen/PDF + compartir)
- [x] Referencia visual de grilla real (Itinerario Ingresos)
- [x] Stack: Next.js + PostgreSQL + Prisma
- [x] **Fase 1 implementada:** login, paneles vacíos por rol, seed, sin Contacto en landing
- [x] **Fase 2 implementada:** Admin crea/elimina usuarios y asigna entidad
- [x] **Fase 3 implementada:** Transportes, pasajeros, asignación de vehículo a choferes
- [x] **Fase 4 implementada:** Áreas, destinos y asignaciones (Administración)
- [x] **Fase 5 implementada:** Grillas (crear, listar, WhatsApp texto, imprimir)
- [x] **Multi-rol:** un usuario puede tener varios roles (excepto Admin); Gladis Admin en seed
- [x] **Fase 6 implementada:** Paneles Celadora / Chofer (reloj, asistencia, Maps/Waze, informe)
- [x] **Fase 7 implementada:** Informe/métricas (Admin + Administración) + publicaciones con vigencia
- [x] **Fase 8 implementada:** Respaldo historiales (CSV Excel + imprimir/PDF)

---

## Notas de trabajo

- Desarrollar **parte por parte** según el plan de fases.
- Stack y alcance principal: **confirmados**.
- **Fases 1–8 + multi-rol:** listas.
- Commit Fases 1–3 ya pusheado a GitHub (`4d9a20d`). Avances posteriores pendientes de commit/push.

### Claim DB (desarrollo)
DB reclamada por el usuario.

---

## Estado al cierre (22 jul 2026)

### Hecho en código
- Landing sin Contacto; CTA hero → WhatsApp; botón **Iniciar sesión**
- Auth (login/logout/sesión JWT) + middleware por rol
- Paneles: `/panel/admin`, `/panel/administracion`, `/panel/celadora`, `/panel/chofer`
- Admin: usuarios, transportes, pasajeros, asignación chofer↔transporte
- Prisma + PostgreSQL; seed: Hori, Fernanda, Camila, Seba (pass `1234`)

### Próxima sesión — Fase 4
- Áreas (seed San Miguel / Villa de Mayo)
- Destinos
- Asignaciones de la Administración (celadoras, transportes, pasajeros)

### Recordatorios técnicos
- Variables locales en `.env` / `.env.local` (no van a Git): `DATABASE_URL`, `AUTH_SECRET`
- Tras cambios de schema: `npx prisma generate && npx prisma db push`
- Si el dev server queda “viejo”: un solo `npm run dev` (evitar dos puertos 3000/3001)
- Scripts útiles: `npm run db:seed`, `npm run db:setup`

---

## Respaldo de historiales (acordado)

Además de la base de datos, se implementará (en una fase posterior a grillas/métricas) la posibilidad de:

- **Descargar** historiales (PDF y/o Excel)
- **Imprimir** historiales desde el panel (Admin / Administración)

Objetivo: que la empresa tenga copia en papel o archivo local como respaldo ante fallos técnicos.

Alcance tentativo:
- Por rango de fechas
- Por área / destino / transporte / pasajero (filtros)
- Incluir asistencias, tiempos de recorrido e informes

Prioridad: después de Fase 5–7 (cuando ya exista historial real que exportar).
