import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase.js'

export function useAuth() {
  const [autenticado, setAutenticado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorAuth, setErrorAuth] = useState('')
  const [procesandoLogin, setProcesandoLogin] = useState(false)

  useEffect(() => {
    // 1. Obtener la sesión actual inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAutenticado(!!session)
      setCargando(false)
    })

    // 2. Suscribirse a los cambios de estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAutenticado(!!session)
      setCargando(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setProcesandoLogin(true)
    setErrorAuth('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) {
        console.error('[Supabase Auth Error]', error)
        let msg = 'Credenciales incorrectas. Verifica el correo y la contraseña.'
        if (error.message.includes('Email not confirmed')) {
          msg = 'El email no está confirmado en Supabase. Marca "Auto Confirm" en el panel de usuarios.'
        } else if (error.message.includes('Invalid login credentials')) {
          msg = 'Correo o contraseña incorrectos.'
        } else {
          msg = `Error: ${error.message}`
        }
        setErrorAuth(msg)
        setProcesandoLogin(false)
        return false
      }

      if (data?.session) {
        setAutenticado(true)
      }

      setProcesandoLogin(false)
      return true
    } catch (e) {
      console.error('[Login Catch]', e)
      setErrorAuth('Ocurrió un error inesperado al conectar con el servidor.')
      setProcesandoLogin(false)
      return false
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setAutenticado(false)
    setErrorAuth('')
  }, [])

  return {
    autenticado,
    cargando,
    errorAuth,
    procesandoLogin,
    login,
    logout,
    setErrorAuth,
  }
}
