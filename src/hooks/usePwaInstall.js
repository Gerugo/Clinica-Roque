import { useState, useEffect, useCallback } from 'react'
import { esDispositivoApple, esModoStandalone } from '../utils/deviceDetection.js'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [esApple] = useState(() => esDispositivoApple() && !esModoStandalone())
  const [instalada, setInstalada] = useState(() => esModoStandalone())

  useEffect(() => {
    // Si ya se ejecuta en modo PWA standalone, no necesitamos escuchar eventos
    if (instalada) return

    // 1. Capturar el evento de instalación en Android / Chromium / Desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    // 2. Escuchar cuando la instalación se completa
    const handleAppInstalled = () => {
      setInstalada(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [instalada])

  const instalarApp = useCallback(async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      setInstalada(true)
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  return {
    puedeInstalar: !!deferredPrompt && !instalada,
    esApple: esApple && !instalada,
    instalada,
    instalarApp,
  }
}
