/**
 * Constantes globales de la aplicación Clínica Roque
 */

// Clave VAPID pública para Web Push Notifications
export const DEFAULT_VAPID_KEY = 'BGHmKycJbLHBjay-25jQURBSW1-SELwwHh4EnZ57-GhCEw4zvW1zFhvbqw2H9neaFPUrGSy3IqzAwNqDxscOxMw'

export const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULT_VAPID_KEY

// Estados posibles de un turno
export const ESTADOS_TURNO = {
  ESPERA: 'espera',
  LLAMADO: 'llamado',
  ATENDIDO: 'atendido',
  DESCARTADO: 'descartado',
}

// Clave de almacenamiento en LocalStorage para pacientes
export const STORAGE_KEYS = {
  TURNOS_PACIENTE: 'turnos_paciente',
}

// Configuración de audio chime (tonos de aviso)
export const AUDIO_CONFIG = {
  PANTALLA_FRECUENCIA_1: 587.33, // D5
  PANTALLA_FRECUENCIA_2: 880.00, // A5
  MOVIL_FRECUENCIA: 880.00,
}

// Tiempo de duración del overlay de turno en TV (en ms)
export const DURACION_OVERLAY_PANTALLA_MS = 12000

// Configuración de estimación de colas (ETA)
export const ETA_CONFIG = {
  MINUTOS_DEFAULT_POR_PACIENTE: 8,
  MIN_MINUTOS_CONSULTA: 1,
  MAX_MINUTOS_CONSULTA: 45,
  MAX_MUESTRAS_HISTORICO: 5,
}
