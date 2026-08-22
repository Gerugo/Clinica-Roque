/**
 * Servicio de síntesis de voz (Text-to-Speech) para la pantalla TV de sala de espera
 * Utiliza la Web Speech API nativa del navegador en español.
 */

class VoiceAnnounceService {
  constructor() {
    this.speechAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window
    this.voice = null
    this.initVoice()
  }

  initVoice() {
    if (!this.speechAvailable) return

    const selectSpanishVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      // Priorizar voces en español de alta calidad (Google, Microsoft, naturales)
      const spanishVoice =
        voices.find((v) => v.lang === 'es-ES' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Pablo') || v.name.includes('Laura') || v.name.includes('Helena'))) ||
        voices.find((v) => v.lang.startsWith('es-')) ||
        voices.find((v) => v.lang === 'es')

      if (spanishVoice) {
        this.voice = spanishVoice
      }
    }

    selectSpanishVoice()

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = selectSpanishVoice
    }
  }

  /**
   * Deletrea el código del turno para que la síntesis de voz lo pronuncie claro
   * Ej: "A4B" -> "A, 4, B"
   */
  formatearCodigo(codigo) {
    if (!codigo) return ''
    return codigo.split('').join(', ')
  }

  /**
   * Anuncia el turno por voz
   * @param {string} numeroTurno Ej: "A4B"
   * @param {string} nombreSala Ej: "Consulta 1 - Traumatología"
   */
  anunciarTurno(numeroTurno, nombreSala) {
    if (!this.speechAvailable || !numeroTurno || !nombreSala) return

    try {
      // Cancelar cualquier mensaje pendiente previo
      window.speechSynthesis.cancel()

      const codigoDeletreado = this.formatearCodigo(numeroTurno)
      const texto = `Turno ${codigoDeletreado}. Por favor, acuda a ${nombreSala}.`

      const utterance = new SpeechSynthesisUtterance(texto)
      utterance.lang = 'es-ES'
      utterance.rate = 0.92 // Velocidad ligeramente pausada para máxima claridad
      utterance.pitch = 1.05

      if (this.voice) {
        utterance.voice = this.voice
      }

      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.warn('[VoiceService] No se pudo reproducir la síntesis de voz:', e)
    }
  }
}

export const voiceService = new VoiceAnnounceService()
