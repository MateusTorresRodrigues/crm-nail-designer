// Paleta categórica validada (CVD-safe) para os gráficos do Dashboard.
// A paleta suave usada na Agenda (cores-profissionais.ts) é intencionalmente
// pastel para a identidade visual e não passa nos testes de acessibilidade
// para leitura de dados — por isso os gráficos usam esta paleta separada.
export const CATEGORICO = [
  '#2a78d6', // azul
  '#eb6834', // laranja (próximo da terracota da marca)
  '#1baf7a', // verde-água
  '#eda100', // amarelo
  '#e87ba4', // magenta
  '#008300', // verde
  '#4a3aa7', // violeta
  '#e34948', // vermelho
]

export function corCategorica(indice: number) {
  return CATEGORICO[indice % CATEGORICO.length]
}

export const STATUS = {
  agendado: '#fab219', // warning
  confirmado: '#0ca30c', // good
  cancelado: '#d03b3b', // critical
  concluido: '#2a78d6', // categórico slot 1 (estado final neutro/positivo)
}

export const CHROME = {
  grid: '#e1e0d9',
  eixo: '#c3c2b7',
  textoMudo: '#898781',
  textoSecundario: '#52514e',
}
