import { useEffect, useMemo, useState } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import { useCadastrosApoio } from '@/hooks/useCadastrosApoio'
import type { Contato, StatusContato } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { COLUNAS_KANBAN } from '@/components/leads/kanban-config'
import { CLASSIFICACOES } from '@/components/leads/classificacao-config'
import LeadColumn from '@/components/leads/LeadColumn'
import LeadCard from '@/components/leads/LeadCard'
import LeadModal from '@/components/leads/LeadModal'
import NovoLeadModal from '@/components/leads/NovoLeadModal'

const TODAS_CLASSIFICACOES = '__todas__'

export default function Leads() {
  const { user } = useAuth()
  const { profissionais, servicos } = useCadastrosApoio()

  const [leads, setLeads] = useState<Contato[]>([])
  const [carregando, setCarregando] = useState(true)
  const [leadArrastando, setLeadArrastando] = useState<Contato | null>(null)
  const [leadSelecionado, setLeadSelecionado] = useState<Contato | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [novoLeadAberto, setNovoLeadAberto] = useState(false)
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>(TODAS_CLASSIFICACOES)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    let ativo = true

    async function carregar() {
      const { data } = await supabase
        .from('crm_naildesigner')
        .select('*')
        .eq('tipo', 'lead')
        .order('created_at', { ascending: false })

      if (!ativo) return
      setLeads(data ?? [])
      setCarregando(false)
    }

    carregar()

    const canal = supabase
      .channel('crm-leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_naildesigner' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const idRemovido = (payload.old as Contato).id
            setLeads((atual) => atual.filter((lead) => lead.id !== idRemovido))
            return
          }

          const registro = payload.new as Contato

          setLeads((atual) => {
            const existe = atual.some((lead) => lead.id === registro.id)

            if (registro.tipo !== 'lead') {
              return existe ? atual.filter((lead) => lead.id !== registro.id) : atual
            }

            if (existe) {
              return atual.map((lead) => (lead.id === registro.id ? registro : lead))
            }

            return [registro, ...atual]
          })
        },
      )
      .subscribe()

    return () => {
      ativo = false
      supabase.removeChannel(canal)
    }
  }, [])

  const leadsFiltrados = useMemo(() => {
    if (filtroClassificacao === TODAS_CLASSIFICACOES) return leads
    return leads.filter((lead) => lead.classificacao === filtroClassificacao)
  }, [leads, filtroClassificacao])

  const leadsPorColuna = useMemo(() => {
    const mapa = new Map<StatusContato, Contato[]>()
    for (const coluna of COLUNAS_KANBAN) mapa.set(coluna.status, [])
    for (const lead of leadsFiltrados) {
      mapa.get(lead.status)?.push(lead)
    }
    return mapa
  }, [leadsFiltrados])

  function handleDragStart(evento: DragStartEvent) {
    const lead = leads.find((l) => l.id === evento.active.id)
    setLeadArrastando(lead ?? null)
  }

  async function handleDragEnd(evento: DragEndEvent) {
    setLeadArrastando(null)
    const { active, over } = evento
    if (!over) return

    const novoStatus = over.id as StatusContato
    const lead = leads.find((l) => l.id === active.id)
    if (!lead || lead.status === novoStatus) return

    const statusAnterior = lead.status
    setLeads((atual) => atual.map((l) => (l.id === lead.id ? { ...l, status: novoStatus } : l)))

    const { error } = await supabase
      .from('crm_naildesigner')
      .update({ status: novoStatus })
      .eq('id', lead.id)

    if (error) {
      setLeads((atual) => atual.map((l) => (l.id === lead.id ? { ...l, status: statusAnterior } : l)))
      alert('Não foi possível mover o lead: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'mover_lead_kanban',
      tabela: 'crm_naildesigner',
      idRegistro: lead.id,
      dadosAnteriores: { status: statusAnterior },
      dadosNovos: { status: novoStatus },
    })
  }

  function abrirLead(lead: Contato) {
    setLeadSelecionado(lead)
    setModalAberto(true)
  }

  function lidarComAtualizacao(leadAtualizado: Contato) {
    if (leadAtualizado.tipo !== 'lead') {
      setLeads((atual) => atual.filter((l) => l.id !== leadAtualizado.id))
      return
    }
    setLeads((atual) => atual.map((l) => (l.id === leadAtualizado.id ? leadAtualizado : l)))
  }

  function lidarComExclusao(id: string) {
    setLeads((atual) => atual.filter((l) => l.id !== id))
  }

  function lidarComCriacao(lead: Contato) {
    setLeads((atual) => [lead, ...atual])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Arraste os cards entre as colunas para atualizar o status do lead.
        </p>
        <div className="flex items-center gap-3">
          <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS_CLASSIFICACOES}>Todas as classificações</SelectItem>
              {CLASSIFICACOES.map((c) => (
                <SelectItem key={c.valor} value={c.valor}>
                  {c.emoji} {c.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setNovoLeadAberto(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo lead
          </Button>
        </div>
      </div>

      {carregando && <p className="text-sm text-muted-foreground">Carregando leads...</p>}

      {!carregando && (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUNAS_KANBAN.map((coluna) => (
              <LeadColumn
                key={coluna.status}
                coluna={coluna}
                leads={leadsPorColuna.get(coluna.status) ?? []}
                onSelecionarLead={abrirLead}
              />
            ))}
          </div>

          <DragOverlay>
            {leadArrastando && <LeadCard lead={leadArrastando} onClick={() => {}} />}
          </DragOverlay>
        </DndContext>
      )}

      <LeadModal
        lead={leadSelecionado}
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        profissionais={profissionais}
        servicos={servicos}
        onAtualizado={lidarComAtualizacao}
        onExcluido={lidarComExclusao}
      />

      <NovoLeadModal
        aberto={novoLeadAberto}
        onOpenChange={setNovoLeadAberto}
        onCriado={lidarComCriacao}
      />
    </div>
  )
}
