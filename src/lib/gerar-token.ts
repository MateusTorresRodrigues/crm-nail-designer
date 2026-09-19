export function gerarToken() {
  const aleatorio = crypto.randomUUID().replace(/-/g, '')
  return `nd_${aleatorio}`
}
