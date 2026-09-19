import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { Contato } from '@/types/database'
import type { ColunaKanban } from './kanban-config'
import LeadCard from './LeadCard'

interface LeadColumnProps {
  coluna: ColunaKanban
  leads: Contato[]
  onSelecionarLead: (lead: Contato) => void
}

export default function LeadColumn({ coluna, leads, onSelecionarLead }: LeadColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.status })

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-2xl bg-muted/50">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-serif text-base font-semibold text-foreground">{coluna.titulo}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2.5 rounded-xl p-2.5 transition-colors',
          isOver && 'bg-primary/10',
        )}
      >
        {leads.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nenhum lead nesta etapa
          </p>
        )}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onSelecionarLead(lead)} />
        ))}
      </div>
    </div>
  )
}
