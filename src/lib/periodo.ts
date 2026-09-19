export type PeriodoPreset = 'hoje' | '7dias' | '30dias' | 'personalizado'

export interface IntervaloPeriodo {
  inicio: Date
  fim: Date
}

function inicioDoDia(data: Date) {
  const d = new Date(data)
  d.setHours(0, 0, 0, 0)
  return d
}

function fimDoDia(data: Date) {
  const d = new Date(data)
  d.setHours(23, 59, 59, 999)
  return d
}

export function calcularIntervalo(
  preset: PeriodoPreset,
  personalizado?: { inicio: string; fim: string },
): IntervaloPeriodo {
  const hoje = new Date()

  if (preset === 'hoje') {
    return { inicio: inicioDoDia(hoje), fim: fimDoDia(hoje) }
  }

  if (preset === '7dias') {
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - 6)
    return { inicio: inicioDoDia(inicio), fim: fimDoDia(hoje) }
  }

  if (preset === '30dias') {
    const inicio = new Date(hoje)
    inicio.setDate(inicio.getDate() - 29)
    return { inicio: inicioDoDia(inicio), fim: fimDoDia(hoje) }
  }

  if (personalizado?.inicio && personalizado?.fim) {
    return {
      inicio: inicioDoDia(new Date(`${personalizado.inicio}T00:00:00`)),
      fim: fimDoDia(new Date(`${personalizado.fim}T00:00:00`)),
    }
  }

  return { inicio: inicioDoDia(hoje), fim: fimDoDia(hoje) }
}

const DIA_POR_INDICE = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const

export function diaSemanaChave(data: Date) {
  return DIA_POR_INDICE[data.getDay()]
}
