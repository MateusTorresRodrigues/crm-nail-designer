export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab'

export interface IntervaloHorario {
  inicio: string
  fim: string
}

export type Disponibilidade = Partial<Record<DiaSemana, IntervaloHorario | null>>

export interface Configuracao {
  id: string
  nome_negocio: string
  logo_url: string | null
  fuso_horario: string
  dias_inatividade: number
  horario_funcionamento: Disponibilidade | null
  percentual_sinal: number
  created_at: string
  updated_at: string
}

export type StatusPagamento = 'pendente' | 'pago' | 'falhou' | 'estornado'
export type FormaPagamento = 'pix' | 'cartao'

export interface Pagamento {
  id: string
  id_agendamento: string | null
  tipo: 'unico' | 'recorrente'
  valor: number
  status: StatusPagamento
  provedor: string
  id_externo: string | null
  forma_pagamento: FormaPagamento | null
  link_pagamento: string | null
  descricao: string | null
  created_at: string
  updated_at: string
}

export interface ApiToken {
  id: string
  nome: string
  token: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Usuario {
  id: string
  nome: string
  email: string
  created_at: string
  updated_at: string
}

export interface Profissional {
  id: string
  nome: string
  horario_almoco_inicio: string | null
  horario_almoco_fim: string | null
  disponibilidade: Disponibilidade | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface Servico {
  id: string
  nome: string
  duracao_minutos: number
  valor: number
  dias_retorno: number | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export type TipoContato = 'lead' | 'cliente'

export type StatusContato =
  | 'novo'
  | 'conversando'
  | 'agendado'
  | 'cancelou'
  | 'compareceu'
  | 'follow_up_1'
  | 'follow_up_2'

export type Classificacao = 'quente' | 'morno' | 'frio'

export interface Contato {
  id: string
  whatsapp: string
  nome: string | null
  tipo: TipoContato
  status: StatusContato
  origem: string | null
  observacoes: string | null
  profissional_preferida: string | null
  servico_interesse: string | null
  horario_preferencia: string | null
  classificacao: Classificacao
  motivo_contato: string | null
  resumo_conversa: string | null
  inicio_atendimento: string | null
  ultima_mensagem: string | null
  minutos_ultima_mensagem: number | null
  data_agendamento: string | null
  id_agendamento: string | null
  follow_up_1: string | null
  follow_up_2: string | null
  created_at: string
  updated_at: string
}

export type StatusAgendamento = 'agendado' | 'confirmado' | 'cancelado' | 'concluido'

export interface Agendamento {
  id: string
  id_cliente: string
  id_profissional: string
  id_servico: string
  data_hora_inicio: string
  data_hora_fim: string
  status: StatusAgendamento
  created_at: string
  updated_at: string
}

export interface Comanda {
  id: string
  id_cliente: string
  id_profissional: string
  id_agendamento: string | null
  status: 'aberta' | 'fechada'
  valor_total: number
  created_at: string
  updated_at: string
}

export interface ItemComanda {
  id: string
  id_comanda: string
  id_servico: string | null
  id_produto: string | null
  quantidade: number
  valor_unitario: number
  valor_total: number
  created_at: string
}

export interface Produto {
  id: string
  nome: string
  preco: number
  estoque: number
  ativo: boolean
  created_at: string
  updated_at: string
}
