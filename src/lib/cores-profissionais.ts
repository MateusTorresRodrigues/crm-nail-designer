const PALETA = [
  { bg: '#B96B62', texto: '#FFFFFF' }, // terracota (cor primária)
  { bg: '#7C8B6F', texto: '#FFFFFF' }, // verde acinzentado (cor de destaque)
  { bg: '#8E7CC3', texto: '#FFFFFF' }, // roxo suave
  { bg: '#5B8FA3', texto: '#FFFFFF' }, // azul acinzentado
  { bg: '#C9A24B', texto: '#FFFFFF' }, // dourado envelhecido
  { bg: '#A85C7C', texto: '#FFFFFF' }, // vinho rosado
  { bg: '#6B9080', texto: '#FFFFFF' }, // verde salvia
  { bg: '#B0785C', texto: '#FFFFFF' }, // marrom terroso
]

export function corDaProfissional(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PALETA[hash % PALETA.length]
}
