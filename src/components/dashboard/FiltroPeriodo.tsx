import type { PeriodoPreset } from '@/lib/periodo'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FiltroPeriodoProps {
  preset: PeriodoPreset
  onPresetChange: (preset: PeriodoPreset) => void
  dataInicio: string
  dataFim: string
  onDataInicioChange: (valor: string) => void
  onDataFimChange: (valor: string) => void
}

const OPCOES: { valor: PeriodoPreset; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: '30dias', rotulo: 'Últimos 30 dias' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
]

export default function FiltroPeriodo({
  preset,
  onPresetChange,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
}: FiltroPeriodoProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {OPCOES.map((opcao) => (
          <button
            key={opcao.valor}
            onClick={() => onPresetChange(opcao.valor)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              preset === opcao.valor
                ? 'bg-card shadow-card text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {preset === 'personalizado' && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="h-9 w-40"
            value={dataInicio}
            onChange={(e) => onDataInicioChange(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-9 w-40"
            value={dataFim}
            onChange={(e) => onDataFimChange(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}
