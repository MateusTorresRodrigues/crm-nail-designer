import type { Agendamento } from '@/types/database'

export interface EventoAgenda {
  id: string
  title: string
  start: Date
  end: Date
  clienteNome: string
  profissionalNome: string
  profissionalId: string
  servicoNome: string
  agendamento: Agendamento
  pagamentoPendente: boolean
}
