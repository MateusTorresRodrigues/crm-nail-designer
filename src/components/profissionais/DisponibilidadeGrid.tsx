import { DIAS_SEMANA } from '@/lib/disponibilidade'
import type { Disponibilidade } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface DisponibilidadeGridProps {
  value: Disponibilidade
  onChange: (valor: Disponibilidade) => void
  rotuloInativo?: string
}

const PADRAO: { inicio: string; fim: string } = { inicio: '09:00', fim: '18:00' }

export default function DisponibilidadeGrid({
  value,
  onChange,
  rotuloInativo = 'Não atende',
}: DisponibilidadeGridProps) {
  function alternarDia(dia: keyof Disponibilidade, atende: boolean) {
    onChange({ ...value, [dia]: atende ? { ...PADRAO, ...value[dia] } : null })
  }

  function alterarHorario(dia: keyof Disponibilidade, campo: 'inicio' | 'fim', horario: string) {
    const atual = value[dia] ?? PADRAO
    onChange({ ...value, [dia]: { ...atual, [campo]: horario } })
  }

  return (
    <div className="space-y-2">
      {DIAS_SEMANA.map(({ chave, rotulo }) => {
        const intervalo = value[chave]
        const atende = Boolean(intervalo)

        return (
          <div
            key={chave}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-3 py-2"
          >
            <Label className="flex w-40 shrink-0 items-center gap-2 text-sm font-normal">
              <input
                type="checkbox"
                checked={atende}
                onChange={(e) => alternarDia(chave, e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {rotulo}
            </Label>

            {atende ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="h-9 w-28"
                  value={intervalo?.inicio ?? PADRAO.inicio}
                  onChange={(e) => alterarHorario(chave, 'inicio', e.target.value)}
                />
                <span className="text-sm text-muted-foreground">às</span>
                <Input
                  type="time"
                  className="h-9 w-28"
                  value={intervalo?.fim ?? PADRAO.fim}
                  onChange={(e) => alterarHorario(chave, 'fim', e.target.value)}
                />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{rotuloInativo}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
