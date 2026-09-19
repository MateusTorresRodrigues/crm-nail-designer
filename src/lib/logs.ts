import { supabase } from '@/lib/supabase'

interface RegistrarLogParams {
  usuarioId: string | null | undefined
  acao: string
  tabela?: string
  idRegistro?: string
  dadosAnteriores?: unknown
  dadosNovos?: unknown
}

export async function registrarLog({
  usuarioId,
  acao,
  tabela,
  idRegistro,
  dadosAnteriores,
  dadosNovos,
}: RegistrarLogParams) {
  const { error } = await supabase.from('logs_sistema').insert({
    id_usuario: usuarioId ?? null,
    acao,
    tabela: tabela ?? null,
    id_registro: idRegistro ?? null,
    dados_anteriores: dadosAnteriores ?? null,
    dados_novos: dadosNovos ?? null,
  })

  if (error) {
    console.error('Falha ao registrar log do sistema:', error.message)
  }
}
