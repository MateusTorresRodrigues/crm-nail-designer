import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gerarSinalAgendamento } from "../_shared/asaas.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

// Gera a cobrança de sinal (Asaas) para um agendamento criado manualmente pela Agenda.
// Autenticação é o próprio JWT do Supabase (usuário logado no sistema) — verify_jwt: true
// nesta função, diferente da função "api" (que usa token próprio para o agente de IA).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return erroResposta("Método não permitido.", 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const corpo = await req.json().catch(() => null);
  const idAgendamento = corpo?.id_agendamento;
  const formaPagamento = corpo?.forma_pagamento === "cartao" ? "cartao" : "pix";
  const cpfCnpj = typeof corpo?.cpf_cnpj === "string" ? corpo.cpf_cnpj.trim() : undefined;

  if (typeof idAgendamento !== "string" || !idAgendamento) {
    return erroResposta("Informe id_agendamento.");
  }

  const { data: agendamento } = await admin
    .from("agendamentos")
    .select("id, id_cliente, id_servico")
    .eq("id", idAgendamento)
    .maybeSingle();
  if (!agendamento) return erroResposta("Agendamento não encontrado.", 404);

  const { data: existente } = await admin
    .from("pagamentos")
    .select("id")
    .eq("id_agendamento", idAgendamento)
    .neq("status", "estornado")
    .maybeSingle();
  if (existente) return erroResposta("Já existe uma cobrança gerada para este agendamento.", 409);

  const { data: cliente } = await admin
    .from("crm_naildesigner")
    .select("id, nome, whatsapp")
    .eq("id", agendamento.id_cliente)
    .maybeSingle();
  if (!cliente) return erroResposta("Cliente vinculado ao agendamento não foi encontrado.", 500);

  const { data: servico } = await admin
    .from("servicos")
    .select("nome, valor")
    .eq("id", agendamento.id_servico)
    .maybeSingle();
  if (!servico) return erroResposta("Serviço vinculado ao agendamento não foi encontrado.", 500);

  const resultado = await gerarSinalAgendamento(admin, {
    idAgendamento: agendamento.id,
    idCliente: cliente.id,
    nomeCliente: cliente.nome ?? "Cliente",
    whatsapp: cliente.whatsapp,
    cpfCnpj,
    valorServico: Number(servico.valor),
    formaPagamento,
    descricao: `Sinal - ${servico.nome}`,
  });

  try {
    await admin.from("logs_sistema").insert({
      id_usuario: null,
      acao: resultado.sucesso ? "gerar_sinal_agendamento" : "falha_gerar_sinal_agendamento",
      tabela: "pagamentos",
      id_registro: agendamento.id,
      dados_novos: resultado.sucesso
        ? { valor: resultado.valor, link_pagamento: resultado.linkPagamento }
        : { erro: resultado.erro },
    });
  } catch (_erro) {
    // best-effort
  }

  if (!resultado.sucesso) {
    return erroResposta(resultado.erro, 502);
  }

  return jsonResponse({ sucesso: true, link_pagamento: resultado.linkPagamento ?? null, valor: resultado.valor });
});
