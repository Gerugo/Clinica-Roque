import { useState, useEffect, useCallback, useRef } from 'react'
import { calcularMetricasTurno } from '../services/tickets.js'

export function useQueueEstimation(turnosEnEspera) {
  const [posiciones, setPosiciones] = useState({})
  const [etasMins, setEtasMins] = useState({})
  const [calculando, setCalculando] = useState(false)
  const debounceTimerRef = useRef(null)

  const recalcularMetricas = useCallback(async () => {
    if (!turnosEnEspera || turnosEnEspera.length === 0) {
      setPosiciones({})
      setEtasMins({})
      return
    }

    setCalculando(true)

    const nuevasPosiciones = {}
    const nuevosEtas = {}

    // Ejecutar cálculos en paralelo para todos los turnos del paciente
    await Promise.all(
      turnosEnEspera.map(async (turno) => {
        const { personasAdelante, minutosEstimados } = await calcularMetricasTurno(
          turno.cola_id,
          turno.id
        )
        nuevasPosiciones[turno.id] = personasAdelante
        nuevosEtas[turno.id] = minutosEstimados
      })
    )

    setPosiciones(nuevasPosiciones)
    setEtasMins(nuevosEtas)
    setCalculando(false)
  }, [turnosEnEspera])

  // Debounced effect para evitar llamadas excesivas cuando llegan eventos Realtime rápidos
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      recalcularMetricas()
    }, 200)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [recalcularMetricas])

  return {
    posiciones,
    etasMins,
    calculando,
    recalcularMetricas,
  }
}
