import { useEffect, useMemo, useState } from 'react'
import { Calendar, dateFnsLocalizer, Views, type SlotInfo, type View, type ToolbarProps } from 'react-big-calendar'
import withDragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, getDay, isSameDay, parse, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { corDaProfissional } from '@/lib/cores-profissionais'
import { useAuth } from '@/contexts/AuthContext'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { useCadastrosApoio } from '@/hooks/useCadastrosApoio'
import type { Agendamento, Disponibilidade } from '@/types/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import NovoAgendamentoModal from '@/components/agenda/NovoAgendamentoModal'
import AgendamentoDetalhesModal from '@/components/agenda/AgendamentoDetalhesModal'
import type { EventoAgenda } from '@/components/agenda/tipos'

const OPCOES_VISAO: { valor: View; rotulo: string }[] = [
  { valor: Views.MONTH, rotulo: 'Mês' },
  { valor: Views.WEEK, rotulo: 'Semana' },
  { valor: Views.DAY, rotulo: 'Dia' },
]

function BarraFerramentasPremium({ label, view, views, onNavigate, onView }: ToolbarProps<EventoAgenda>) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>
          Hoje
        </Button>
        <div className="flex items-center overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            onClick={() => onNavigate('PREV')}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Período anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => onNavigate('NEXT')}
            className="flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Próximo período"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <h2 className="font-serif text-xl font-semibold text-foreground">{label}</h2>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-muted p-1">
        {(views as View[]).map((v) => {
          const opcao = OPCOES_VISAO.find((o) => o.valor === v)
          if (!opcao) return null
          return (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
                view === v ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground',
              )}
            >
              {opcao.rotulo}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Evita abrir a Agenda mostrando meia-noite: começa a visão de semana/dia já rolada
// para o horário de abertura da clínica (menor "início" cadastrado em Configurações),
// com 8h como reserva caso nada esteja configurado ainda.
function calcularHorarioInicial(horarioFuncionamento: Disponibilidade | null | undefined): Date {
  const horarios = Object.values(horarioFuncionamento ?? {}).filter(
    (h): h is NonNullable<typeof h> => h != null,
  )
  const minutosIniciais = horarios.map((h) => {
    const [hora, minuto] = h.inicio.split(':').map(Number)
    return hora * 60 + minuto
  })
  const minutoMaisCedo = minutosIniciais.length > 0 ? Math.min(...minutosIniciais) : 8 * 60

  const referencia = new Date()
  referencia.setHours(Math.floor(minutoMaisCedo / 60), minutoMaisCedo % 60, 0, 0)
  return referencia
}

function CabecalhoDiaMes({ date, label }: { date: Date; label: string }) {
  const hoje = isSameDay(date, new Date())
  return (
    <div className="flex justify-end p-1.5">
      <span
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full text-xs',
          hoje ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  )
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: ptBR }),
  getDay,
  locales: { 'pt-BR': ptBR },
})

const MENSAGENS = {
  date: 'Data',
  time: 'Hora',
  event: 'Agendamento',
  allDay: 'Dia inteiro',
  week: 'Semana',
  work_week: 'Semana útil',
  day: 'Dia',
  month: 'Mês',
  previous: 'Anterior',
  next: 'Próximo',
  yesterday: 'Ontem',
  tomorrow: 'Amanhã',
  today: 'Hoje',
  agenda: 'Lista',
  noEventsInRange: 'Nenhum agendamento neste período.',
  showMore: (total: number) => `+ ${total} mais`,
}

const DnDCalendar = withDragAndDrop<EventoAgenda>(Calendar)

const TODAS = '__todas__'

export default function Agenda() {
  const { user } = useAuth()
  const { configuracao } = useConfiguracao()
  const { profissionais, servicos } = useCadastrosApoio()

  const horarioInicialAgenda = useMemo(
    () => calcularHorarioInicial(configuracao?.horario_funcionamento),
    [configuracao?.horario_funcionamento],
  )

  const [eventos, setEventos] = useState<EventoAgenda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroProfissional, setFiltroProfissional] = useState(TODAS)
  const [view, setView] = useState<View>(Views.WEEK)
  const [dataAtual, setDataAtual] = useState(new Date())

  const [slotSelecionado, setSlotSelecionado] = useState<{ inicio: Date; fim: Date; profissionalId?: string } | null>(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [eventoSelecionado, setEventoSelecionado] = useState<EventoAgenda | null>(null)
  const [detalhesAberto, setDetalhesAberto] = useState(false)

  async function carregarAgendamentos() {
    setCarregando(true)

    const { data } = await supabase
      .from('agendamentos')
      .select(
        '*, crm_naildesigner!agendamentos_id_cliente_fkey(nome, whatsapp), profissionais(nome), servicos(nome), pagamentos(status)',
      )
      .order('data_hora_inicio')

    const mapeados: EventoAgenda[] = (data ?? []).map((linha) => {
      const agendamento = linha as unknown as Agendamento
      const cliente = (linha as { crm_naildesigner: { nome: string | null; whatsapp: string } | null })
        .crm_naildesigner
      const profissional = (linha as { profissionais: { nome: string } | null }).profissionais
      const servicoRelacionado = (linha as { servicos: { nome: string } | null }).servicos
      const pagamentos = (linha as { pagamentos: { status: string }[] | null }).pagamentos ?? []

      const nomeCliente = cliente?.nome || cliente?.whatsapp || 'Cliente'
      // Sinal ainda não pago: agendamento fica visível (a vaga já está reservada), mas
      // marcado como pendente até o pagamento confirmar (ou até não haver sinal a pagar).
      const pagamentoPendente =
        agendamento.status === 'agendado' && pagamentos.some((p) => p.status === 'pendente')

      return {
        id: agendamento.id,
        title: `${nomeCliente} — ${servicoRelacionado?.nome ?? ''}`,
        start: new Date(agendamento.data_hora_inicio),
        end: new Date(agendamento.data_hora_fim),
        clienteNome: nomeCliente,
        profissionalNome: profissional?.nome ?? '—',
        profissionalId: agendamento.id_profissional,
        servicoNome: servicoRelacionado?.nome ?? '—',
        agendamento,
        pagamentoPendente,
      }
    })

    setEventos(mapeados)
    setCarregando(false)
  }

  useEffect(() => {
    carregarAgendamentos()
  }, [])

  const eventosFiltrados = useMemo(() => {
    if (filtroProfissional === TODAS) return eventos
    return eventos.filter((evento) => evento.profissionalId === filtroProfissional)
  }, [eventos, filtroProfissional])

  function abrirNovoAgendamento(slotInfo: SlotInfo) {
    const horaMeiaNoite = slotInfo.start.getHours() === 0 && slotInfo.start.getMinutes() === 0
    const inicio = new Date(slotInfo.start)
    if (view === Views.MONTH || horaMeiaNoite) {
      inicio.setHours(9, 0, 0, 0)
    }
    const fim = new Date(inicio.getTime() + 60 * 60000)

    setSlotSelecionado({
      inicio,
      fim,
      profissionalId: filtroProfissional !== TODAS ? filtroProfissional : undefined,
    })
    setNovoAberto(true)
  }

  function abrirDetalhes(evento: EventoAgenda) {
    setEventoSelecionado(evento)
    setDetalhesAberto(true)
  }

  async function lidarComArrastar({ event, start, end }: EventInteractionArgs<EventoAgenda>) {
    if (event.agendamento.status === 'cancelado' || event.agendamento.status === 'concluido') return

    const inicio = start instanceof Date ? start : new Date(start)
    const fim = end instanceof Date ? end : new Date(end)

    setEventos((atual) =>
      atual.map((e) => (e.id === event.id ? { ...e, start: inicio, end: fim } : e)),
    )

    const { error } = await supabase
      .from('agendamentos')
      .update({ data_hora_inicio: inicio.toISOString(), data_hora_fim: fim.toISOString() })
      .eq('id', event.id)

    if (error) {
      alert('Não foi possível remarcar: ' + error.message)
      carregarAgendamentos()
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'remarcar_agendamento_arrastar',
      tabela: 'agendamentos',
      idRegistro: event.id,
      dadosAnteriores: { data_hora_inicio: event.agendamento.data_hora_inicio },
      dadosNovos: { data_hora_inicio: inicio.toISOString() },
    })

    carregarAgendamentos()
  }

  const profissionaisAtivas = profissionais.filter((p) => p.ativo)

  function EventoCard({ event }: { event: EventoAgenda }) {
    const cor = corDaProfissional(event.profissionalId)
    const cancelado = event.agendamento.status === 'cancelado'
    const concluido = event.agendamento.status === 'concluido'

    if (view === Views.MONTH) {
      return (
        <div className={cn('flex items-center gap-1.5 overflow-hidden px-0.5', cancelado && 'opacity-50')}>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: cor.bg, opacity: concluido ? 0.6 : 1 }}
          />
          <span className={cn('truncate text-xs font-medium text-foreground', cancelado && 'line-through')}>
            {event.clienteNome}
          </span>
          {event.pagamentoPendente && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
        </div>
      )
    }

    const duracaoMin = (event.end.getTime() - event.start.getTime()) / 60000
    const mostrarServico = duracaoMin >= 60
    const mostrarHorario = duracaoMin >= 90

    return (
      <div
        className={cn(
          'flex h-full flex-col justify-center gap-0.5 overflow-hidden rounded-md border-l-[3px] bg-white px-2 py-0.5 shadow-sm',
          (cancelado || concluido) && 'opacity-60',
        )}
        style={{ borderLeftColor: cor.bg }}
      >
        <span className={cn('truncate text-[11px] font-semibold leading-tight text-foreground', cancelado && 'line-through')}>
          {event.clienteNome}
        </span>
        {mostrarServico && (
          <span className="truncate text-[10px] leading-tight text-muted-foreground">{event.servicoNome}</span>
        )}
        {mostrarHorario && (
          <span className="truncate text-[10px] leading-tight text-muted-foreground">
            {format(event.start, 'HH:mm')}–{format(event.end, 'HH:mm')}
          </span>
        )}
        {event.pagamentoPendente && (
          <Badge className="w-fit bg-amber-500/15 px-1.5 py-0 text-[9px] font-medium leading-tight text-amber-700">
            Aguardando pagamento
          </Badge>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {profissionaisAtivas.map((p) => {
            const cor = corDaProfissional(p.id)
            return (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor.bg }} />
                {p.nome}
              </span>
            )
          })}
        </div>

        <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as profissionais</SelectItem>
            {profissionaisAtivas.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-5">
          {carregando ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando agenda...</p>
          ) : (
            <div style={{ height: 720 }}>
              <DnDCalendar
                localizer={localizer}
                culture="pt-BR"
                messages={MENSAGENS}
                events={eventosFiltrados}
                view={view}
                onView={setView}
                date={dataAtual}
                onNavigate={setDataAtual}
                views={[Views.MONTH, Views.WEEK, Views.DAY]}
                scrollToTime={horarioInicialAgenda}
                selectable
                onSelectSlot={abrirNovoAgendamento}
                onSelectEvent={abrirDetalhes}
                onEventDrop={lidarComArrastar}
                draggableAccessor={(evento) =>
                  evento.agendamento.status !== 'cancelado' && evento.agendamento.status !== 'concluido'
                }
                resizable={false}
                popup
                components={{
                  toolbar: BarraFerramentasPremium,
                  event: EventoCard,
                  month: { dateHeader: CabecalhoDiaMes },
                }}
                eventPropGetter={() => ({
                  style: { backgroundColor: 'transparent', border: 'none', padding: 0, boxShadow: 'none' },
                })}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <NovoAgendamentoModal
        aberto={novoAberto}
        onOpenChange={setNovoAberto}
        slot={slotSelecionado}
        profissionais={profissionaisAtivas}
        servicos={servicos}
        onCriado={carregarAgendamentos}
      />

      <AgendamentoDetalhesModal
        evento={eventoSelecionado}
        aberto={detalhesAberto}
        onOpenChange={setDetalhesAberto}
        profissionais={profissionais}
        onAtualizado={carregarAgendamentos}
      />
    </div>
  )
}
