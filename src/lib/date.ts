const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatarData(valor: string | null | undefined) {
  if (!valor) return '—'
  return formatadorData.format(new Date(valor))
}

export function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return '—'
  return formatadorDataHora.format(new Date(valor))
}

export function formatarValor(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarTempoRelativo(minutos: number | null | undefined) {
  if (minutos === null || minutos === undefined) return '—'

  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) {
    const valor = Math.round(minutos)
    return `há ${valor} ${valor === 1 ? 'minuto' : 'minutos'}`
  }

  const horas = Math.round(minutos / 60)
  if (horas < 24) {
    return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }

  const dias = Math.round(horas / 24)
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
}

export function diasEntre(dataAnterior: string | Date, dataAtual: string | Date = new Date()) {
  const inicio = new Date(dataAnterior)
  const fim = new Date(dataAtual)
  const msPorDia = 1000 * 60 * 60 * 24
  return Math.floor((fim.getTime() - inicio.getTime()) / msPorDia)
}
