import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gerarSinalAgendamento } from "../_shared/asaas.ts";

const STATUS_PAGAMENTO_POR_EVENTO: Record<string, "pago" | "falhou" | "estornado"> = {
  PAYMENT_CONFIRMED: "pago",
  PAYMENT_RECEIVED: "pago",
  PAYMENT_OVERDUE: "falhou",
  PAYMENT_FAILED: "falhou",
  PAYMENT_REFUNDED: "estornado",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function jsonResponse(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function erroResposta(mensagem: string, status = 400) {
  return jsonResponse({ sucesso: false, mensagem }, status);
}

const STATUS_LEAD_VALIDOS = [
  "novo",
  "conversando",
  "agendado",
  "cancelou",
  "compareceu",
  "follow_up_1",
  "follow_up_2",
];

const DIA_POR_INDICE = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IntervaloHorario {
  inicio: string;
  fim: string;
}

// --- Utilitários de data/hora (clínica opera em America/Sao_Paulo, UTC-3 fixo) ---

function paraDataUtc(naiveOuComFuso: string): Date {
  // Aceita "2026-09-20T14:00:00" (interpretado como America/Sao_Paulo) ou uma
  // string já com fuso/Z explícito.
  if (/Z$|[+-]\d{2}:\d{2}$/.test(naiveOuComFuso)) {
    return new Date(naiveOuComFuso);
  }
  return new Date(`${naiveOuComFuso}-03:00`);
}

function diaSemanaChave(dataUtc: Date): (typeof DIA_POR_INDICE)[number] {
  // America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019): desloca o
  // instante 3h para trás e lê o dia da semana em UTC, evitando depender do
  // fuso horário da máquina que executa a função.
  const deslocado = new Date(dataUtc.getTime() - 3 * 60 * 60 * 1000);
  return DIA_POR_INDICE[deslocado.getUTCDay()];
}

function minutosDeHorario(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

function formatarMensagemAgendamento(inicio: Date, profissionalNome: string): string {
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = Object.fromEntries(formatador.formatToParts(inicio).map((p) => [p.type, p.value]));
  const hora = partes.minute === "00" ? `${partes.hour}h` : `${partes.hour}h${partes.minute}`;
  return `Agendamento confirmado para ${partes.day}/${partes.month} às ${hora} com ${profissionalNome}.`;
}

// --- Autenticação por token da tabela api_tokens ---

async function autenticar(
  req: Request,
  admin: SupabaseClient,
): Promise<{ id: string; nome: string } | null> {
  const cabecalho = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data } = await admin
    .from("api_tokens")
    .select("id, nome, ativo")
    .eq("token", token)
    .maybeSingle();

  if (!data || !data.ativo) return null;
  return { id: data.id, nome: data.nome };
}

async function registrarLog(
  admin: SupabaseClient,
  params: {
    acao: string;
    tabela?: string;
    idRegistro?: string;
    dadosAnteriores?: unknown;
    dadosNovos?: unknown;
  },
) {
  try {
    await admin.from("logs_sistema").insert({
      id_usuario: null,
      acao: params.acao,
      tabela: params.tabela ?? null,
      id_registro: params.idRegistro ?? null,
      dados_anteriores: params.dadosAnteriores ?? null,
      dados_novos: params.dadosNovos ?? null,
    });
  } catch (_erro) {
    // Log é best-effort: nunca deve derrubar a resposta da API.
  }
}

async function resolverId(
  admin: SupabaseClient,
  tabela: "servicos" | "profissionais",
  valor: unknown,
): Promise<string | null> {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const valorLimpo = valor.trim();

  if (UUID_REGEX.test(valorLimpo)) {
    const { data } = await admin.from(tabela).select("id").eq("id", valorLimpo).maybeSingle();
    return data?.id ?? null;
  }

  const { data } = await admin.from(tabela).select("id").ilike("nome", valorLimpo).maybeSingle();
  return data?.id ?? null;
}

// --- Endpoints ---

async function criarOuAtualizarLead(req: Request, admin: SupabaseClient) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.whatsapp !== "string" || !corpo.whatsapp.trim()) {
    return erroResposta("Informe o WhatsApp do lead.");
  }

  const whatsapp = corpo.whatsapp.trim();

  const [servicoId, profissionalId] = await Promise.all([
    resolverId(admin, "servicos", corpo.servico_interesse),
    resolverId(admin, "profissionais", corpo.profissional_preferida),
  ]);

  const camposOpcionais: Record<string, unknown> = {};
  if (typeof corpo.nome === "string") camposOpcionais.nome = corpo.nome.trim();
  if (typeof corpo.origem === "string") camposOpcionais.origem = corpo.origem.trim();
  if (typeof corpo.motivo_contato === "string") camposOpcionais.motivo_contato = corpo.motivo_contato.trim();
  if (typeof corpo.resumo_conversa === "string") camposOpcionais.resumo_conversa = corpo.resumo_conversa.trim();
  if (typeof corpo.horario_preferencia === "string") {
    camposOpcionais.horario_preferencia = corpo.horario_preferencia.trim();
  }
  if (corpo.servico_interesse !== undefined) camposOpcionais.servico_interesse = servicoId;
  if (corpo.profissional_preferida !== undefined) camposOpcionais.profissional_preferida = profissionalId;

  const { data: existente } = await admin
    .from("crm_naildesigner")
    .select("id")
    .eq("whatsapp", whatsapp)
    .maybeSingle();

  let linha;
  let erro;

  if (existente) {
    const dadosNovos = { ...camposOpcionais, ultima_mensagem: new Date().toISOString() };
    ({ data: linha, error: erro } = await admin
      .from("crm_naildesigner")
      .update(dadosNovos)
      .eq("id", existente.id)
      .select("id, classificacao")
      .single());

    if (!erro) {
      await registrarLog(admin, {
        acao: "api_atualizar_lead",
        tabela: "crm_naildesigner",
        idRegistro: existente.id,
        dadosNovos,
      });
    }
  } else {
    const dadosNovos = {
      whatsapp,
      tipo: "lead" as const,
      status: "novo" as const,
      ultima_mensagem: new Date().toISOString(),
      ...camposOpcionais,
    };
    ({ data: linha, error: erro } = await admin
      .from("crm_naildesigner")
      .insert(dadosNovos)
      .select("id, classificacao")
      .single());

    if (!erro && linha) {
      await registrarLog(admin, {
        acao: "api_criar_lead",
        tabela: "crm_naildesigner",
        idRegistro: linha.id,
        dadosNovos,
      });
    }
  }

  if (erro || !linha) {
    return erroResposta("Não foi possível salvar o lead: " + (erro?.message ?? "erro desconhecido"), 500);
  }

  return jsonResponse({ sucesso: true, lead_id: linha.id, classificacao: linha.classificacao });
}

async function atualizarStatusLead(req: Request, admin: SupabaseClient) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.whatsapp !== "string" || !corpo.whatsapp.trim()) {
    return erroResposta("Informe o WhatsApp do lead.");
  }
  if (typeof corpo.status !== "string" || !STATUS_LEAD_VALIDOS.includes(corpo.status)) {
    return erroResposta("Status inválido.");
  }

  const whatsapp = corpo.whatsapp.trim();

  const { data: linha, error: erro } = await admin
    .from("crm_naildesigner")
    .update({ status: corpo.status })
    .eq("whatsapp", whatsapp)
    .select("id")
    .maybeSingle();

  if (erro) {
    return erroResposta("Não foi possível atualizar o status: " + erro.message, 500);
  }
  if (!linha) {
    return erroResposta("Lead não encontrado para esse WhatsApp.", 404);
  }

  await registrarLog(admin, {
    acao: "api_atualizar_status_lead",
    tabela: "crm_naildesigner",
    idRegistro: linha.id,
    dadosNovos: { status: corpo.status },
  });

  return jsonResponse({ sucesso: true, mensagem: "Status atualizado com sucesso." });
}

async function consultarServicos(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("servicos")
    .select("id, nome, duracao_minutos, valor")
    .eq("ativo", true)
    .order("nome");

  if (error) return erroResposta("Não foi possível consultar os serviços: " + error.message, 500);

  await registrarLog(admin, { acao: "api_consultar_servicos", tabela: "servicos" });

  return jsonResponse({ sucesso: true, servicos: data ?? [] });
}

async function consultarProfissionais(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("profissionais")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  if (error) return erroResposta("Não foi possível consultar as profissionais: " + error.message, 500);

  await registrarLog(admin, { acao: "api_consultar_profissionais", tabela: "profissionais" });

  return jsonResponse({ sucesso: true, profissionais: data ?? [] });
}

async function consultarDisponibilidade(url: URL, admin: SupabaseClient) {
  const idServico = url.searchParams.get("id_servico");
  const dataParam = url.searchParams.get("data");
  const idProfissionalParam = url.searchParams.get("id_profissional");

  if (!idServico || !dataParam) {
    return erroResposta("Informe id_servico e data.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataParam)) {
    return erroResposta("O parâmetro data deve estar no formato AAAA-MM-DD.");
  }

  const { data: servico } = await admin
    .from("servicos")
    .select("duracao_minutos")
    .eq("id", idServico)
    .eq("ativo", true)
    .maybeSingle();

  if (!servico) return erroResposta("Serviço não encontrado ou inativo.", 404);

  const { data: configuracao } = await admin
    .from("configuracoes")
    .select("horario_funcionamento")
    .limit(1)
    .maybeSingle();

  const diaReferencia = paraDataUtc(`${dataParam}T12:00:00`);
  const diaChave = diaSemanaChave(diaReferencia);
  const horarioClinica: IntervaloHorario | null =
    configuracao?.horario_funcionamento?.[diaChave] ?? null;

  if (!horarioClinica) {
    return jsonResponse({ sucesso: true, horarios_disponiveis: [] });
  }

  let queryProfissionais = admin
    .from("profissionais")
    .select("id, nome, horario_almoco_inicio, horario_almoco_fim, disponibilidade")
    .eq("ativo", true);

  if (idProfissionalParam) {
    queryProfissionais = queryProfissionais.eq("id", idProfissionalParam);
  }

  const { data: profissionais } = await queryProfissionais;
  if (!profissionais || profissionais.length === 0) {
    return jsonResponse({ sucesso: true, horarios_disponiveis: [] });
  }

  const inicioDia = paraDataUtc(`${dataParam}T00:00:00`);
  const fimDia = paraDataUtc(`${dataParam}T23:59:59`);

  const { data: agendamentosDoDia } = await admin
    .from("agendamentos")
    .select("id_profissional, data_hora_inicio, data_hora_fim")
    .gte("data_hora_inicio", inicioDia.toISOString())
    .lte("data_hora_inicio", fimDia.toISOString())
    .neq("status", "cancelado");

  const duracao = servico.duracao_minutos;
  const GRANULARIDADE_MINUTOS = 30;
  const resultado: { profissional_id: string; profissional_nome: string; horario: string }[] = [];

  for (const profissional of profissionais) {
    const disponibilidadeDia: IntervaloHorario | null | undefined =
      profissional.disponibilidade?.[diaChave];

    // disponibilidade cadastrada e explicitamente nula para o dia = profissional não atende
    if (profissional.disponibilidade && diaChave in profissional.disponibilidade && !disponibilidadeDia) {
      continue;
    }

    const janelaInicio = Math.max(
      minutosDeHorario(horarioClinica.inicio),
      disponibilidadeDia ? minutosDeHorario(disponibilidadeDia.inicio) : -Infinity,
    );
    const janelaFim = Math.min(
      minutosDeHorario(horarioClinica.fim),
      disponibilidadeDia ? minutosDeHorario(disponibilidadeDia.fim) : Infinity,
    );

    const almocoInicio = profissional.horario_almoco_inicio
      ? minutosDeHorario(profissional.horario_almoco_inicio.slice(0, 5))
      : null;
    const almocoFim = profissional.horario_almoco_fim
      ? minutosDeHorario(profissional.horario_almoco_fim.slice(0, 5))
      : null;

    const agendamentosProfissional = (agendamentosDoDia ?? []).filter(
      (a) => a.id_profissional === profissional.id,
    );

    for (
      let inicioSlotMin = janelaInicio;
      inicioSlotMin + duracao <= janelaFim;
      inicioSlotMin += GRANULARIDADE_MINUTOS
    ) {
      const fimSlotMin = inicioSlotMin + duracao;

      if (almocoInicio !== null && almocoFim !== null) {
        const sobrepoeAlmoco = inicioSlotMin < almocoFim && fimSlotMin > almocoInicio;
        if (sobrepoeAlmoco) continue;
      }

      const horaStr = String(Math.floor(inicioSlotMin / 60)).padStart(2, "0");
      const minutoStr = String(inicioSlotMin % 60).padStart(2, "0");
      const slotInicioUtc = paraDataUtc(`${dataParam}T${horaStr}:${minutoStr}:00`);
      const slotFimUtc = new Date(slotInicioUtc.getTime() + duracao * 60000);

      const conflita = agendamentosProfissional.some((a) => {
        const aInicio = new Date(a.data_hora_inicio);
        const aFim = new Date(a.data_hora_fim);
        return slotInicioUtc < aFim && slotFimUtc > aInicio;
      });
      if (conflita) continue;

      resultado.push({
        profissional_id: profissional.id,
        profissional_nome: profissional.nome,
        horario: `${dataParam}T${horaStr}:${minutoStr}:00`,
      });
    }
  }

  resultado.sort((a, b) => a.horario.localeCompare(b.horario));

  await registrarLog(admin, { acao: "api_consultar_disponibilidade", tabela: "agendamentos" });

  return jsonResponse({ sucesso: true, horarios_disponiveis: resultado });
}

async function criarAgendamento(req: Request, admin: SupabaseClient) {
  const corpo = await req.json().catch(() => null);
  if (!corpo) return erroResposta("Corpo da requisição inválido.");

  const { whatsapp, nome_cliente, id_profissional, id_servico, data_hora_inicio, forma_pagamento, cpf_cnpj } = corpo;

  if (typeof whatsapp !== "string" || !whatsapp.trim()) return erroResposta("Informe o WhatsApp do cliente.");
  if (typeof id_profissional !== "string" || !id_profissional) return erroResposta("Informe id_profissional.");
  if (typeof id_servico !== "string" || !id_servico) return erroResposta("Informe id_servico.");
  if (typeof data_hora_inicio !== "string" || !data_hora_inicio) {
    return erroResposta("Informe data_hora_inicio.");
  }
  const formaPagamentoSinal: "pix" | "cartao" = forma_pagamento === "cartao" ? "cartao" : "pix";

  const { data: servico } = await admin
    .from("servicos")
    .select("nome, duracao_minutos, valor")
    .eq("id", id_servico)
    .maybeSingle();
  if (!servico) return erroResposta("Serviço não encontrado.", 404);

  const { data: profissional } = await admin
    .from("profissionais")
    .select("id, nome")
    .eq("id", id_profissional)
    .maybeSingle();
  if (!profissional) return erroResposta("Profissional não encontrada.", 404);

  let idCliente: string;
  let nomeCliente: string;
  const { data: clienteExistente } = await admin
    .from("crm_naildesigner")
    .select("id, nome")
    .eq("whatsapp", whatsapp.trim())
    .maybeSingle();

  if (clienteExistente) {
    idCliente = clienteExistente.id;
    nomeCliente = clienteExistente.nome ?? "Cliente";
  } else {
    if (typeof nome_cliente !== "string" || !nome_cliente.trim()) {
      return erroResposta("Informe nome_cliente para cadastrar um novo cliente.");
    }
    const { data: novoCliente, error: erroCliente } = await admin
      .from("crm_naildesigner")
      .insert({ whatsapp: whatsapp.trim(), nome: nome_cliente.trim() })
      .select("id")
      .single();
    if (erroCliente || !novoCliente) {
      return erroResposta("Não foi possível cadastrar o cliente: " + erroCliente?.message, 500);
    }
    idCliente = novoCliente.id;
    nomeCliente = nome_cliente.trim();
  }

  const inicio = paraDataUtc(data_hora_inicio);
  const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60000);

  const { data: agendamento, error: erroAgendamento } = await admin
    .from("agendamentos")
    .insert({
      id_cliente: idCliente,
      id_profissional,
      id_servico,
      data_hora_inicio: inicio.toISOString(),
      data_hora_fim: fim.toISOString(),
      status: "agendado",
    })
    .select("id")
    .single();

  if (erroAgendamento || !agendamento) {
    const mensagemErro = erroAgendamento?.message ?? "";
    if (mensagemErro.includes("Conflito de horário")) {
      return erroResposta("Esse horário já está ocupado. Escolha outro horário disponível.", 409);
    }
    return erroResposta("Não foi possível criar o agendamento: " + mensagemErro, 500);
  }

  await registrarLog(admin, {
    acao: "api_criar_agendamento",
    tabela: "agendamentos",
    idRegistro: agendamento.id,
    dadosNovos: { id_cliente: idCliente, id_profissional, id_servico, data_hora_inicio: inicio.toISOString() },
  });

  const sinal = await gerarSinalAgendamento(admin, {
    idAgendamento: agendamento.id,
    idCliente,
    nomeCliente,
    whatsapp: whatsapp.trim(),
    cpfCnpj: typeof cpf_cnpj === "string" ? cpf_cnpj.trim() : undefined,
    valorServico: Number(servico.valor),
    formaPagamento: formaPagamentoSinal,
    descricao: `Sinal - ${servico.nome}`,
  });

  await registrarLog(admin, {
    acao: sinal.sucesso ? "api_gerar_sinal_agendamento" : "api_falha_gerar_sinal_agendamento",
    tabela: "pagamentos",
    idRegistro: agendamento.id,
    dadosNovos: sinal.sucesso ? { valor: sinal.valor, link_pagamento: sinal.linkPagamento } : { erro: sinal.erro },
  });

  let mensagem = formatarMensagemAgendamento(inicio, profissional.nome);
  if (sinal.sucesso && sinal.linkPagamento) {
    mensagem += ` Para confirmar, envie o sinal pelo link: ${sinal.linkPagamento}`;
  } else if (!sinal.sucesso) {
    mensagem += ` (não foi possível gerar o link do sinal: ${sinal.erro})`;
  }

  return jsonResponse({
    sucesso: true,
    agendamento_id: agendamento.id,
    link_pagamento: sinal.sucesso ? sinal.linkPagamento ?? null : null,
    mensagem,
  });
}

async function remarcarAgendamento(req: Request, admin: SupabaseClient, id: string) {
  const corpo = await req.json().catch(() => null);
  if (!corpo || typeof corpo.data_hora_inicio !== "string" || !corpo.data_hora_inicio) {
    return erroResposta("Informe data_hora_inicio.");
  }

  const { data: agendamentoAtual } = await admin
    .from("agendamentos")
    .select("id, id_servico")
    .eq("id", id)
    .maybeSingle();
  if (!agendamentoAtual) return erroResposta("Agendamento não encontrado.", 404);

  const { data: servico } = await admin
    .from("servicos")
    .select("duracao_minutos")
    .eq("id", agendamentoAtual.id_servico)
    .maybeSingle();
  if (!servico) return erroResposta("Serviço vinculado ao agendamento não foi encontrado.", 500);

  const inicio = paraDataUtc(corpo.data_hora_inicio);
  const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60000);

  const { error: erroUpdate } = await admin
    .from("agendamentos")
    .update({ data_hora_inicio: inicio.toISOString(), data_hora_fim: fim.toISOString() })
    .eq("id", id);

  if (erroUpdate) {
    if (erroUpdate.message.includes("Conflito de horário")) {
      return erroResposta("Esse horário já está ocupado. Escolha outro horário disponível.", 409);
    }
    return erroResposta("Não foi possível remarcar o agendamento: " + erroUpdate.message, 500);
  }

  await registrarLog(admin, {
    acao: "api_remarcar_agendamento",
    tabela: "agendamentos",
    idRegistro: id,
    dadosNovos: { data_hora_inicio: inicio.toISOString() },
  });

  return jsonResponse({ sucesso: true, mensagem: "Agendamento remarcado com sucesso." });
}

async function cancelarAgendamento(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("agendamentos")
    .update({ status: "cancelado" })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return erroResposta("Não foi possível cancelar o agendamento: " + error.message, 500);
  if (!data) return erroResposta("Agendamento não encontrado.", 404);

  await registrarLog(admin, {
    acao: "api_cancelar_agendamento",
    tabela: "agendamentos",
    idRegistro: id,
    dadosNovos: { status: "cancelado" },
  });

  return jsonResponse({ sucesso: true, mensagem: "Agendamento cancelado com sucesso." });
}

async function processarWebhookAsaas(req: Request, admin: SupabaseClient) {
  const tokenEsperado = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const tokenRecebido = req.headers.get("asaas-access-token");
  if (!tokenEsperado || tokenRecebido !== tokenEsperado) {
    return erroResposta("Origem não autorizada.", 401);
  }

  const corpo = await req.json().catch(() => null);
  const evento: string | undefined = corpo?.event;
  const idExterno: string | undefined = corpo?.payment?.id;

  if (!evento || !idExterno) {
    return erroResposta("Payload do webhook inválido.");
  }

  const novoStatus = STATUS_PAGAMENTO_POR_EVENTO[evento];
  if (!novoStatus) {
    // Evento que não altera status (ex.: PAYMENT_CREATED) — apenas confirma recebimento.
    return jsonResponse({ sucesso: true, mensagem: "Evento recebido, nenhuma ação necessária." });
  }

  const { data: pagamento } = await admin
    .from("pagamentos")
    .select("id, status")
    .eq("id_externo", idExterno)
    .maybeSingle();

  if (!pagamento) {
    await registrarLog(admin, {
      acao: "api_webhook_asaas_pagamento_nao_encontrado",
      tabela: "pagamentos",
      idRegistro: idExterno,
      dadosNovos: { evento },
    });
    return jsonResponse({ sucesso: true, mensagem: "Pagamento não localizado para este id_externo." });
  }

  // Idempotência: se o status já reflete este evento, não reprocessa nem duplica o log.
  if (pagamento.status === novoStatus) {
    return jsonResponse({ sucesso: true, mensagem: "Evento já processado anteriormente." });
  }

  const { error: erroUpdate } = await admin
    .from("pagamentos")
    .update({ status: novoStatus })
    .eq("id", pagamento.id);

  if (erroUpdate) {
    return erroResposta("Não foi possível atualizar o pagamento: " + erroUpdate.message, 500);
  }

  await registrarLog(admin, {
    acao: "api_webhook_asaas_" + evento.toLowerCase(),
    tabela: "pagamentos",
    idRegistro: pagamento.id,
    dadosAnteriores: { status: pagamento.status },
    dadosNovos: { status: novoStatus },
  });

  return jsonResponse({ sucesso: true, mensagem: "Status atualizado com sucesso." });
}

// --- Roteamento ---

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let caminho = url.pathname.replace(/^\/functions\/v1\/api/, "").replace(/^\/api/, "");
  if (caminho === "") caminho = "/";
  caminho = caminho.replace(/\/+$/, "") || "/";

  // O webhook do Asaas não envia o Bearer token do api_tokens: tem autenticação própria
  // (header asaas-access-token, validado dentro do handler), então pula a checagem abaixo.
  if (req.method === "POST" && caminho === "/webhooks/asaas") {
    try {
      return await processarWebhookAsaas(req, admin);
    } catch (erro) {
      return erroResposta("Erro interno: " + (erro instanceof Error ? erro.message : String(erro)), 500);
    }
  }

  const autenticacao = await autenticar(req, admin);
  if (!autenticacao) {
    return erroResposta("Token inválido ou inativo.", 401);
  }

  try {
    if (req.method === "POST" && caminho === "/leads") {
      return await criarOuAtualizarLead(req, admin);
    }
    if (req.method === "PATCH" && caminho === "/leads/status") {
      return await atualizarStatusLead(req, admin);
    }
    if (req.method === "GET" && caminho === "/servicos") {
      return await consultarServicos(admin);
    }
    if (req.method === "GET" && caminho === "/profissionais") {
      return await consultarProfissionais(admin);
    }
    if (req.method === "GET" && caminho === "/agenda/disponibilidade") {
      return await consultarDisponibilidade(url, admin);
    }
    if (req.method === "POST" && caminho === "/agendamentos") {
      return await criarAgendamento(req, admin);
    }

    const remarcarMatch = caminho.match(/^\/agendamentos\/([^/]+)$/);
    if (req.method === "PATCH" && remarcarMatch) {
      return await remarcarAgendamento(req, admin, remarcarMatch[1]);
    }

    const cancelarMatch = caminho.match(/^\/agendamentos\/([^/]+)\/cancelar$/);
    if (req.method === "PATCH" && cancelarMatch) {
      return await cancelarAgendamento(admin, cancelarMatch[1]);
    }

    return erroResposta("Endpoint não encontrado.", 404);
  } catch (erro) {
    return erroResposta("Erro interno: " + (erro instanceof Error ? erro.message : String(erro)), 500);
  }
});
