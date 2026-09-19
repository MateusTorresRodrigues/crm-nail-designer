import { useEffect, useState } from 'react'

export function useDebounce<T>(valor: T, delayMs = 300): T {
  const [valorDebounced, setValorDebounced] = useState(valor)

  useEffect(() => {
    const timeout = setTimeout(() => setValorDebounced(valor), delayMs)
    return () => clearTimeout(timeout)
  }, [valor, delayMs])

  return valorDebounced
}
