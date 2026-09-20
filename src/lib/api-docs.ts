export interface EndpointDoc {
  id: string
  metodo: 'GET' | 'POST' | 'PATCH'
  caminho: string
  titulo: string
  descricao: string
  corpoExemplo?: Record<string, unknown>
  parametrosQuery?: { nome: string; obrigatorio: boolean; descricao: string }[]
  respostaExemplo: Record<string, unknown>
}

export const ENDPOINTS: EndpointDoc[] = [
  {
    id: 'criar-lead',
    metodo: 'POST',
    caminho: '/leads',
    titulo: 'Criar ou atualizar lead',
    descricao:
      'Busca o contato pelo WhatsApp. Se não existir, cria como lead novo; se existir, atualiza os campos enviados e sempre atualiza a última mensagem. A classificação é recalculada automaticamente pelo banco.',
    corpoExemplo: {
      whatsapp: '5511987654321',
      nome: 'Maria Silva',
      origem: 'Instagram',
      motivo_contato: 'Quer saber valores de alongamento',
      resumo_conversa: 'Perguntou sobre alongamento em gel e preferência de horário',
      servico_interesse: 'Alongamento em Gel',
      profissional_preferida: 'Camila Souza',
      horario_preferencia: 'Terças de manhã',
    },
    respostaExemplo: { sucesso: true, lead_id: 'uuid', classificacao: 'quente' },
  },
  {
    id: 'status-lead',
    metodo: 'PATCH',
    caminho: '/leads/status',
    titulo: 'Atualizar status do lead (Kanban)',
    descricao:
      'Atualiza a coluna do Kanban do lead. Valores aceitos: novo, conversando, agendado, cancelou, compareceu, follow_up_1, follow_up_2. Ao mudar para "compareceu", o banco converte o lead em cliente automaticamente.',
    corpoExemplo: { whatsapp: '5511987654321', status: 'conversando' },
    respostaExemplo: { sucesso: true, mensagem: 'Status atualizado com sucesso.' },
  },
  {
    id: 'servicos',
    metodo: 'GET',
    caminho: '/servicos',
    titulo: 'Consultar serviços',
    descricao: 'Retorna todos os serviços ativos, com duração e valor.',
    respostaExemplo: {
      sucesso: true,
      servicos: [{ id: 'uuid', nome: 'Alongamento em Gel', duracao_minutos: 90, valor: 150.0 }],
    },
  },
  {
    id: 'profissionais',
    metodo: 'GET',
    caminho: '/profissionais',
    titulo: 'Consultar profissionais',
    descricao: 'Retorna todas as profissionais ativas.',
    respostaExemplo: { sucesso: true, profissionais: [{ id: 'uuid', nome: 'Camila Souza' }] },
  },
  {
    id: 'produtos',
    metodo: 'GET',
    caminho: '/produtos',
    titulo: 'Consultar produtos',
    descricao: 'Retorna todos os produtos ativos, com preço.',
    respostaExemplo: {
      sucesso: true,
      produtos: [{ id: 'uuid', nome: 'Esmalte branco', preco: 15.0 }],
    },
  },
  {
    id: 'disponibilidade',
    metodo: 'GET',
    caminho: '/agenda/disponibilidade',
    titulo: 'Consultar horários disponíveis',
    descricao:
      'Calcula os horários livres no dia informado, considerando o horário de funcionamento da clínica, a disponibilidade e o horário de almoço da profissional, e os agendamentos já existentes.',
    parametrosQuery: [
      { nome: 'id_servico', obrigatorio: true, descricao: 'Define a duração do atendimento' },
      { nome: 'data', obrigatorio: true, descricao: 'Formato AAAA-MM-DD' },
      { nome: 'id_profissional', obrigatorio: false, descricao: 'Se omitido, retorna de todas as profissionais' },
    ],
    respostaExemplo: {
      sucesso: true,
      horarios_disponiveis: [
        { profissional_id: 'uuid', profissional_nome: 'Camila Souza', horario: '2026-09-20T14:00:00' },
      ],
    },
  },
  {
    id: 'criar-agendamento',
    metodo: 'POST',
    caminho: '/agendamentos',
    titulo: 'Criar agendamento',
    descricao:
      'Busca ou cria o cliente pelo WhatsApp (nome_cliente é obrigatório se ele ainda não existir), calcula o término a partir da duração do serviço e cria o agendamento. Se o horário já estiver ocupado, retorna erro sem criar o registro. Também gera o sinal no Asaas (Pix ou cartão, conforme forma_pagamento) e retorna o link de pagamento — o Asaas exige cpf_cnpj do cliente para gerar a cobrança; sem ele, o agendamento é criado normalmente mas sem link (a mensagem explica o motivo). Envie o campo mensagem direto ao cliente: já vem pronto em pt-BR e inclui o link quando disponível.',
    corpoExemplo: {
      whatsapp: '5511987654321',
      nome_cliente: 'Maria Silva',
      id_profissional: 'uuid-da-profissional',
      id_servico: 'uuid-do-servico',
      data_hora_inicio: '2026-09-20T14:00:00',
      forma_pagamento: 'pix',
      cpf_cnpj: '12345678900',
    },
    respostaExemplo: {
      sucesso: true,
      agendamento_id: 'uuid',
      link_pagamento: 'https://www.asaas.com/i/xxxxxxxxxxxx',
      mensagem:
        'Reservei um horário para 20/09 às 14h com Camila Souza. Esse horário só fica garantido depois do pagamento do sinal — envie pelo link: https://www.asaas.com/i/xxxxxxxxxxxx',
    },
  },
  {
    id: 'consultar-agendamentos-cliente',
    metodo: 'GET',
    caminho: '/agendamentos',
    titulo: 'Consultar agendamentos do cliente',
    descricao:
      'Retorna os agendamentos não cancelados de um cliente pelo WhatsApp, com profissional e serviço. Use para localizar o agendamento_id antes de remarcar ou cancelar.',
    parametrosQuery: [{ nome: 'whatsapp', obrigatorio: true, descricao: 'WhatsApp do cliente' }],
    respostaExemplo: {
      sucesso: true,
      agendamentos: [
        {
          id: 'uuid',
          data_hora_inicio: '2026-09-20T14:00:00+00:00',
          status: 'agendado',
          profissional: 'Camila Souza',
          servico: 'Alongamento em Gel',
        },
      ],
    },
  },
  {
    id: 'remarcar-agendamento',
    metodo: 'PATCH',
    caminho: '/agendamentos/{id}',
    titulo: 'Remarcar agendamento',
    descricao: 'Recalcula o término com base na duração do serviço já vinculado e atualiza o horário do agendamento.',
    corpoExemplo: { data_hora_inicio: '2026-09-20T16:00:00' },
    respostaExemplo: { sucesso: true, mensagem: 'Agendamento remarcado com sucesso.' },
  },
  {
    id: 'cancelar-agendamento',
    metodo: 'PATCH',
    caminho: '/agendamentos/{id}/cancelar',
    titulo: 'Cancelar agendamento',
    descricao: 'Marca o agendamento como cancelado. O banco sincroniza o status do lead/cliente para "cancelou".',
    respostaExemplo: { sucesso: true, mensagem: 'Agendamento cancelado com sucesso.' },
  },
]
