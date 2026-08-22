# 🏥 Clínica Roque - Sistema de Gestión de Turnos y Sala de Espera

Sistema web progresivo (PWA) de alta disponibilidad para la gestión inteligente de salas de espera, llamado de pacientes, sincronización en tiempo real y alertas Web Push para **Clínica Roque**.

---

## 🌟 Vistas y Características Principales

### 1. 📺 Pantalla de Sala de Espera (`/`)
* **Destinatarios**: Pantallas TV y monitores de la sala de espera.
* **Diseño Glassmorphism**: Interfaz con tipografía de alto contraste (oro/salvia sobre fondo clínico).
* **Avisos Acústicos (Chime)**: Generación por síntesis Web Audio API (D5 587.33 Hz ➔ A5 880 Hz).
* **Overlay Gigante**: Notificación animada a pantalla completa (`latido`) durante 12 segundos al llamar a un paciente.
* **Accesibilidad**: Región `aria-live="assertive"` para asistentes de accesibilidad.

### 2. 📱 Recepción / Vista del Paciente (`/recepcion`)
* **Destinatarios**: Pacientes desde su smartphone o dispositivo táctil en recepción.
* **Turno Digital**: Selección de consulta y asignación de código alfanumérico único de 3 caracteres (sin caracteres ambiguos).
* **Algoritmo Dinámico de Cola**:
  * Cuenta exacta de pacientes físicamente por delante.
  * Estimación del tiempo de espera (ETA en minutos) calculada según la velocidad real del médico.
* **Notificaciones Web Push**: Alerta en segundo plano con vibración y sonido al ser llamado o preavisado.
* **Wake Lock API**: Mantiene encendida la pantalla del móvil mientras el paciente espera.
* **Recuperación de Turnos**: Posibilidad de recuperar un turno activo introduciendo el código si se cerró el navegador.
* **Instalación PWA**: Compatible con Android/Desktop (`beforeinstallprompt`) e iOS/iPadOS (guía interactiva de Safari).

### 3. 🩺 Panel de Administración Médica (`/admin`)
* **Destinatarios**: Médicos y personal de recepción.
* **Autenticación**: Inicio de sesión seguro mediante Supabase Auth.
* **Gestión de Salas**: Creación y desactivación de consultas en tiempo real.
* **Llamado Concurrente Seguro**: Compatible con transacciones PostgreSQL atómicas (`FOR UPDATE SKIP LOCKED`).
* **🖨️ Impresión de Tickets en Papel**: Diseñado especialmente para personas mayores o sin smartphone / QR. Imprime tickets físicos legibles con fecha, hora, sala y código.
* **Acciones Rápidas**: Llamar siguiente, re-llamar (hacer sonar la campana de nuevo) y descartar turno.

---

## 🏗️ Arquitectura del Proyecto

```
src/
├── components/           # Componentes UI organizados por contexto
│   ├── admin/            # AdminDashboard, LoginForm, RoomCard
│   ├── common/           # ErrorBoundary, NotFound, LoadingSpinner
│   ├── pantalla/         # WaitingScreen, RoomGrid, TicketOverlay, AudioPermissionModal
│   └── recepcion/        # PatientView, QueueStatus, TicketSelector, TicketRecoveryModal, InstallBanner
├── hooks/                # Lógica reactiva reutilizable
│   ├── useAuth.js               # Estado de sesión y login/logout
│   ├── useAudioChime.js         # Síntesis Web Audio para TV y móvil
│   ├── usePwaInstall.js         # Detección PWA e instalación en iOS/Android
│   ├── useQueueEstimation.js    # Cálculo dinámico de tiempos de espera y ETA
│   ├── useRealtime.js           # Suscripción reactiva a Postgres Realtime
│   └── useWakeLock.js           # Prevención de suspensión de pantalla
├── services/             # Capa de datos y APIs externas
│   ├── printer.js        # Impresión de tickets físicos para personas mayores
│   ├── push.js           # Web Push Notifications y Edge Functions
│   ├── rooms.js          # CRUD de consultas médicas
│   ├── supabase.js       # Cliente Supabase singleton validado
│   └── tickets.js        # Lógica de turnos y llamadas concurrentes
├── styles/               # Design System y hojas de estilo modulares
│   ├── admin.css
│   ├── global.css
│   ├── pantalla.css
│   └── recepcion.css
├── utils/                # Funciones auxiliares puras
│   ├── constants.js
│   ├── deviceDetection.js
│   └── ticketCode.js
├── App.jsx               # Enrutador principal con Lazy Standalone detection
└── main.jsx              # Punto de entrada React 19
```

---

## 🚀 Puesta en Marcha

### 1. Requisitos Previos
* Node.js 18 o superior
* Proyecto en [Supabase](https://supabase.com)

### 2. Configurar Base de Datos en Supabase
1. Entra a tu proyecto en el **Supabase Dashboard**.
2. Ve a **SQL Editor** ➔ **New Query**.
3. Abre el archivo [`supabase/schema.sql`](supabase/schema.sql) de este repositorio, copia todo su contenido y pulsa **Run**.

### 3. Variables de Entorno
Crea un archivo `.env` en la raíz del proyecto tomando como base `.env.example`:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
VITE_VAPID_PUBLIC_KEY=BGHmKycJbLHBjay-25jQURBSW1-SELwwHh4EnZ57-GhCEw4zvW1zFhvbqw2H9neaFPUrGSy3IqzAwNqDxscOxMw
```

### 4. Instalación y Ejecución Local
```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar build de producción
npm run preview
```

---

## 📦 Despliegue en Vercel

El proyecto incluye la configuración [`vercel.json`](vercel.json) para soportar navegación SPA y rutas directas (`/admin`, `/recepcion`). Solo debes conectar tu repositorio a Vercel y agregar las 3 variables de entorno en el panel de Vercel Settings.
