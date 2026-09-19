import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Clock } from 'lucide-react'
import { formatarTempoRelativo } from '@/lib/date'
import type { Contato } from '@/types/database'
import { cn } from '@/lib/utils'
import { obterClassificacao } from './classificacao-config'

interface LeadCardProps {
  lead: Contato
  onClick: () => void
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'cursor-pointer touch-none rounded-xl border border-border bg-card p-3.5 shadow-card transition-shadow hover:shadow-soft',
        isDragging && 'opacity-50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-foreground">{lead.nome || lead.whatsapp}</p>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {obterClassificacao(lead.classificacao).emoji} {obterClassificacao(lead.classificacao).rotulo}
        </span>
      </div>
      {lead.origem && <p className="mt-0.5 text-xs text-muted-foreground">{lead.origem}</p>}
      {lead.resumo_conversa && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{lead.resumo_conversa}</p>
      )}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {formatarTempoRelativo(lead.minutos_ultima_mensagem)}
      </div>
    </div>
  )
}
