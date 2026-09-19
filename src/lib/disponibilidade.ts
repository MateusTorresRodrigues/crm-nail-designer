import type { DiaSemana, Disponibilidade, Profissional } from '@/types/database'

export const DIAS_SEMANA: { chave: DiaSemana; rotulo: string; rotuloCurto: string }[] = [
  { chave: 'dom', rotulo: 'Domingo', rotuloCurto: 'Dom' },
  { chave: 'seg', rotulo: 'Segunda-feira', rotuloCurto: 'Seg' },
  { chave: 'ter', rotulo: 'Terça-feira', rotuloCurto: 'Ter' },
  { chave: 'qua', rotulo: 'Quarta-feira', rotuloCurto: 'Qua' },
  { chave: 'qui', rotulo: 'Quinta-feira', rotuloCurto: 'Qui' },
  { chave: 'sex', rotulo: 'Sexta-feira', rotuloCurto: 'Sex' },
  { chave: 'sab', rotulo: 'Sábado', rotuloCurto: 'Sáb' },
]

const DIA_POR_INDICE: DiaSemana[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function paraMinutos(horario: string) {
  const [horas, minutos] = horario.split(':').map(Number)
  return horas * 60 + minutos
}

function formatarHorario(horario: string) {
  return horario.slice(0, 5)
}

/**
 * Verifica se um intervalo [inicio, fim) cabe dentro da disponibilidade cadastrada da
 * profissional para aquele dia da semana e não invade o horário de almoço.
 * Retorna null quando válido, ou uma mensagem amigável explicando o motivo do bloqueio.
 */
export function validarDisponibilidade(
  profissional: Profissional,
  dataHoraInicio: Date,
  dataHoraFim: Date,
): string | null {
  const dia = DIA_POR_INDICE[dataHoraInicio.getDay()]
  const disponibilidade: Disponibilidade | null = profissional.disponibilidade

  if (disponibilidade && Object.keys(disponibilidade).length > 0) {
    const intervaloDia = disponibilidade[dia]

    if (!intervaloDia) {
      const rotulo = DIAS_SEMANA.find((d) => d.chave === dia)?.rotulo ?? dia
      return `${profissional.nome} não atende em ${rotulo.toLowerCase()}.`
    }

    const inicioMin = dataHoraInicio.getHours() * 60 + dataHoraInicio.getMinutes()
    const fimMin = dataHoraFim.getHours() * 60 + dataHoraFim.getMinutes()
    const disponivelInicio = paraMinutos(intervaloDia.inicio)
    const disponivelFim = paraMinutos(intervaloDia.fim)

    if (inicioMin < disponivelInicio || fimMin > disponivelFim) {
      return `${profissional.nome} atende de ${formatarHorario(intervaloDia.inicio)} às ${formatarHorario(intervaloDia.fim)} nesse dia. Ajuste o horário do agendamento.`
    }
  }

  if (profissional.horario_almoco_inicio && profissional.horario_almoco_fim) {
    const inicioMin = dataHoraInicio.getHours() * 60 + dataHoraInicio.getMinutes()
    const fimMin = dataHoraFim.getHours() * 60 + dataHoraFim.getMinutes()
    const almocoInicio = paraMinutos(profissional.horario_almoco_inicio)
    const almocoFim = paraMinutos(profissional.horario_almoco_fim)

    const sobrepoeAlmoco = inicioMin < almocoFim && fimMin > almocoInicio
    if (sobrepoeAlmoco) {
      return `Esse horário coincide com o almoço de ${profissional.nome} (${formatarHorario(profissional.horario_almoco_inicio)} às ${formatarHorario(profissional.horario_almoco_fim)}).`
    }
  }

  return null
}
