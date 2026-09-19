interface DadosLogProps {
  titulo: string
  dados: Record<string, unknown> | null
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

export default function DadosLog({ titulo, dados }: DadosLogProps) {
  const entradas = dados ? Object.entries(dados) : []

  return (
    <div className="min-w-[180px] flex-1 space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1">
          {entradas.map(([chave, valor]) => (
            <li key={chave} className="text-sm">
              <span className="text-muted-foreground">{chave}:</span>{' '}
              <span className="text-foreground">{formatarValor(valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
