/**
 * Utilidades para detección de dispositivos, navegadores y modos PWA
 */

export function esModoStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  )
}

export function esDispositivoApple() {
  if (typeof window === 'undefined' || !window.navigator) return false

  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIOSLegacy = /iphone|ipad|ipod/.test(userAgent)

  // iPadOS 13+ envía User-Agent de Macintosh de escritorio pero con capacidad táctil
  const isModernIPad =
    window.navigator.platform === 'MacIntel' &&
    window.navigator.maxTouchPoints > 1

  return isIOSLegacy || isModernIPad
}

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
