import type { Classificacao } from '@/types/database'

export const CLASSIFICACOES: { valor: Classificacao; rotulo: string; emoji: string }[] = [
  { valor: 'quente', rotulo: 'Quente', emoji: '🔥' },
  { valor: 'morno', rotulo: 'Morno', emoji: '🟡' },
  { valor: 'frio', rotulo: 'Frio', emoji: '🔵' },
]

export function obterClassificacao(valor: Classificacao) {
  return CLASSIFICACOES.find((c) => c.valor === valor) ?? CLASSIFICACOES[2]
}
