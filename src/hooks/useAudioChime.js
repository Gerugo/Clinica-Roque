import { useRef, useCallback, useEffect } from 'react'
import { AUDIO_CONFIG } from '../utils/constants.js'

export function useAudioChime() {
  const audioCtxRef = useRef(null)
  const timerRef = useRef(null)

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx()
      }
    }

    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    return audioCtxRef.current
  }, [])

  /**
   * Tono doble para pantalla TV de sala de espera
   */
  const reproducirChimePantalla = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime

      // Primer tono (D5 - 587.33 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(AUDIO_CONFIG.PANTALLA_FRECUENCIA_1, now)
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.3)

      // Segundo tono (A5 - 880 Hz) con retraso de 150ms
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (!audioCtxRef.current) return
        const ctx2 = audioCtxRef.current
        const now2 = ctx2.currentTime

        const osc2 = ctx2.createOscillator()
        const gain2 = ctx2.createGain()
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(AUDIO_CONFIG.PANTALLA_FRECUENCIA_2, now2)
        gain2.gain.setValueAtTime(0.3, now2)
        gain2.gain.exponentialRampToValueAtTime(0.01, now2 + 0.5)

        osc2.connect(gain2)
        gain2.connect(ctx2.destination)
        osc2.start(now2)
        osc2.stop(now2 + 0.5)
      }, 150)
    } catch (e) {
      console.warn('Audio Web API no disponible o bloqueado:', e)
    }
  }, [getAudioContext])

  /**
   * Tono suave para móvil del paciente
   */
  const reproducirChimeMovil = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(AUDIO_CONFIG.MOVIL_FRECUENCIA, now)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.5)
    } catch (e) {
      console.warn('Audio móvil no disponible:', e)
    }
  }, [getAudioContext])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [])

  return {
    reproducirChimePantalla,
    reproducirChimeMovil,
    unlockAudio: getAudioContext,
  }
}
