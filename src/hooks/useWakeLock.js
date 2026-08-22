import { useEffect, useRef } from 'react'

export function useWakeLock(activo = true) {
  const wakeLockRef = useRef(null)

  useEffect(() => {
    if (!activo || typeof window === 'undefined' || !('wakeLock' in navigator)) {
      return
    }

    const requestWakeLock = async () => {
      try {
        if (!wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null
          })
        }
      } catch {
        // Ignora silenciosamente errores de batería baja o pestaña oculta
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activo) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [activo])
}
