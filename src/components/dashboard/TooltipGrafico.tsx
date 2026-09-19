interface ItemTooltip {
  rotulo: string
  valor: string
  cor?: string
}

interface TooltipGraficoProps {
  titulo?: string
  itens: ItemTooltip[]
}

export default function TooltipGrafico({ titulo, itens }: TooltipGraficoProps) {
  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 text-sm shadow-soft">
      {titulo && <p className="mb-1.5 font-medium text-foreground">{titulo}</p>}
      <div className="space-y-1">
        {itens.map((item, indice) => (
          <div key={indice} className="flex items-center gap-2">
            {item.cor && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
            )}
            <span className="text-muted-foreground">{item.rotulo}:</span>
            <span className="font-medium text-foreground">{item.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
