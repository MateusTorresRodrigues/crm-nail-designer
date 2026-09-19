import type { StatusContato } from '@/types/database'

export interface ColunaKanban {
  status: StatusContato
  titulo: string
}

export const COLUNAS_KANBAN: ColunaKanban[] = [
  { status: 'novo', titulo: 'Novo' },
  { status: 'conversando', titulo: 'Conversando' },
  { status: 'agendado', titulo: 'Agendado' },
  { status: 'follow_up_1', titulo: 'Follow-up 1' },
  { status: 'follow_up_2', titulo: 'Follow-up 2' },
  { status: 'cancelou', titulo: 'Cancelou' },
]
