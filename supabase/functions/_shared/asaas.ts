import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Domínio real da API (confirmado na documentação oficial) — não confundir com
// sandbox.asaas.com, que é o painel/dashboard de sandbox, não a API.
const BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api-sandbox.asaas.com/v3";

function cabecalhosAsaas(): Record<string, string> | null {
  const chave = Deno.env.get("ASAAS_API_KEY");
  if (!chave) return null;
  return { "Content-Type": "application/json", access_token: chave };
}

interface DadosCobranca {
  clienteId: string; // id do cliente na crm_naildesigner (usado como externalReference)
  nomeCliente: string;
  whatsapp: string;
  cpfCnpj?: string;
  valor: number;
  formaPagamento: "pix" | "cartao";
  descricao: string;
}

interface ResultadoCobranca {
  sucesso: boolean;
  idExterno?: string;
  linkPagamento?: string;
  erro?: string;
}

// Busca um cliente Asaas já vinculado a este contato (via externalReference) ou cria um novo.
// A API do Asaas exige cpfCnpj para cadastrar um cliente; sem ele, a cobrança não pode ser gerada.
async function obterOuCriarClienteAsaas(
  headers: Record<string, string>,
  dados: DadosCobranca,
): Promise<{ id: string } | { erro: string }> {
  const buscaResp = await fetch(`${BASE_URL}/customers?externalReference=${encodeURIComponent(dados.clienteId)}`, {
    headers,
  });
  const busca = await buscaResp.json().catch(() => null);
  if (buscaResp.ok && busca?.data?.length > 0) {
    return { id: busca.data[0].id };
  }

  if (!dados.cpfCnpj) {
    return { erro: "CPF/CNPJ do cliente não informado (obrigatório pelo Asaas para gerar a cobrança)." };
  }

  const criaResp = await fetch(`${BASE_URL}/customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: dados.nomeCliente,
      cpfCnpj: dados.cpfCnpj,
      mobilePhone: dados.whatsapp,
      externalReference: dados.clienteId,
    }),
  });
  const criado = await criaResp.json().catch(() => null);
  if (!criaResp.ok || !criado?.id) {
    const mensagem = criado?.errors?.[0]?.description ?? "Não foi possível cadastrar o cliente no Asaas.";
    return { erro: mensagem };
  }
  return { id: criado.id };
}

export async function criarCobrancaAsaas(dados: DadosCobranca): Promise<ResultadoCobranca> {
  const headers = cabecalhosAsaas();
  if (!headers) {
    return { sucesso: false, erro: "Chave da API do Asaas não configurada (ASAAS_API_KEY)." };
  }

  const cliente = await obterOuCriarClienteAsaas(headers, dados);
  if ("erro" in cliente) {
    return { sucesso: false, erro: cliente.erro };
  }

  const billingType = dados.formaPagamento === "pix" ? "PIX" : "CREDIT_CARD";
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 2);

  const cobrancaResp = await fetch(`${BASE_URL}/payments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      customer: cliente.id,
      billingType,
      value: dados.valor,
      dueDate: vencimento.toISOString().slice(0, 10),
      description: dados.descricao,
    }),
  });
  const cobranca = await cobrancaResp.json().catch(() => null);
  if (!cobrancaResp.ok || !cobranca?.id) {
    const mensagem = cobranca?.errors?.[0]?.description ?? "Não foi possível gerar a cobrança no Asaas.";
    return { sucesso: false, erro: mensagem };
  }

  return { sucesso: true, idExterno: cobranca.id, linkPagamento: cobranca.invoiceUrl };
}

// Cria o registro de sinal (pendente) vinculado ao agendamento, calculado a partir do
// percentual configurado e do valor do serviço. Retorna null quando a cobrança não pôde
// ser gerada (ex.: chave ausente, CPF não informado) — quem chamar decide como comunicar isso.
export async function gerarSinalAgendamento(
  admin: SupabaseClient,
  params: {
    idAgendamento: string;
    idCliente: string;
    nomeCliente: string;
    whatsapp: string;
    cpfCnpj?: string;
    valorServico: number;
    formaPagamento: "pix" | "cartao";
    descricao: string;
  },
): Promise<{ sucesso: true; linkPagamento?: string; valor: number } | { sucesso: false; erro: string }> {
  const { data: configuracao } = await admin
    .from("configuracoes")
    .select("percentual_sinal")
    .limit(1)
    .maybeSingle();

  const percentual = configuracao?.percentual_sinal ?? 50;
  const valorSinal = Math.round(params.valorServico * (percentual / 100) * 100) / 100;

  const resultado = await criarCobrancaAsaas({
    clienteId: params.idCliente,
    nomeCliente: params.nomeCliente,
    whatsapp: params.whatsapp,
    cpfCnpj: params.cpfCnpj,
    valor: valorSinal,
    formaPagamento: params.formaPagamento,
    descricao: params.descricao,
  });

  if (!resultado.sucesso) {
    return { sucesso: false, erro: resultado.erro ?? "Falha desconhecida ao gerar a cobrança." };
  }

  const { error: erroInsert } = await admin.from("pagamentos").insert({
    id_agendamento: params.idAgendamento,
    tipo: "unico",
    valor: valorSinal,
    status: "pendente",
    provedor: "asaas",
    id_externo: resultado.idExterno,
    forma_pagamento: params.formaPagamento,
    link_pagamento: resultado.linkPagamento,
    descricao: params.descricao,
  });

  if (erroInsert) {
    return { sucesso: false, erro: "Cobrança criada no Asaas, mas houve falha ao salvar: " + erroInsert.message };
  }

  return { sucesso: true, linkPagamento: resultado.linkPagamento, valor: valorSinal };
}
