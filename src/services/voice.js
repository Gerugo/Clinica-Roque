/**
 * Servicio de síntesis de voz (Text-to-Speech) para la pantalla TV de sala de espera
 * Utiliza la Web Speech API nativa del navegador en español con dicción pausada.
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
      // Priorizar voces en español de alta calidad y dicción natural
      const spanishVoice =
        voices.find((v) => v.lang === 'es-ES' && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Pablo') || v.name.includes('Laura') || v.name.includes('Helena') || v.name.includes('Jorge'))) ||
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
   * Formatea el código separando cada letra con punto y espacio.
   * Al poner "U. P. P.", el sintetizador lo procesa como siglas individuales
   * evitando que la vocal inicial (como la U) se fusione con la palabra "Turno".
   */
  formatearCodigo(codigo) {
    if (!codigo) return ''
    return codigo
      .trim()
      .split('')
      .map((caracter) => `${caracter.toUpperCase()}.`)
      .join(' ')
  }

  /**
   * Anuncia el turno por voz con separación fonética clara
   * @param {string} numeroTurno Ej: "UPP" -> "U. P. P."
   * @param {string} nombreSala Ej: "Consulta 1"
   */
  anunciarTurno(numeroTurno, nombreSala) {
    if (!this.speechAvailable || !numeroTurno || !nombreSala) return

    try {
      window.speechSynthesis.cancel()

      const codigoDeletreado = this.formatearCodigo(numeroTurno)
      // La estructura "Turno número... U. P. P." da una pausa fonética perfecta
      const texto = `Turno número: ${codigoDeletreado} Por favor, pase a: ${nombreSala}.`

      const utterance = new SpeechSynthesisUtterance(texto)
      utterance.lang = 'es-ES'
      utterance.rate = 0.85 // Velocidad más pausada para que cada letra se entienda al 100%
      utterance.pitch = 1.0

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
