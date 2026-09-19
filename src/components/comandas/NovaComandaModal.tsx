import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Contato, Profissional } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ClienteBuscaCampo from '@/components/agenda/ClienteBuscaCampo'

interface AgendamentoHoje {
  id: string
  cliente_id: string
  cliente_nome: string
  profissional_id: string
  profissional_nome: string
  servico_nome: string
  hora: string
}

interface NovaComandaModalProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  profissionais: Profissional[]
  onCriada: (id: string) => void
}

const MODO_BUSCA = 'busca'
const MODO_AGENDAMENTO = 'agendamento'

export default function NovaComandaModal({
  aberto,
  onOpenChange,
  profissionais,
  onCriada,
}: NovaComandaModalProps) {
  const { user } = useAuth()

  const [modo, setModo] = useState<typeof MODO_BUSCA | typeof MODO_AGENDAMENTO>(MODO_BUSCA)
  const [cliente, setCliente] = useState<Contato | null>(null)
  const [profissionalId, setProfissionalId] = useState('')

  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoHoje[]>([])
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(false)
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<AgendamentoHoje | null>(null)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setModo(MODO_BUSCA)
    setCliente(null)
    setProfissionalId('')
    setAgendamentoSelecionado(null)
    setErro(null)
  }, [aberto])

  useEffect(() => {
    if (!aberto || modo !== MODO_AGENDAMENTO) return

    let ativo = true
    setCarregandoAgendamentos(true)

    const inicioHoje = new Date()
    inicioHoje.setHours(0, 0, 0, 0)
    const fimHoje = new Date()
    fimHoje.setHours(23, 59, 59, 999)

    supabase
      .from('agendamentos')
      .select(
        'id, data_hora_inicio, id_cliente, id_profissional, crm_naildesigner!agendamentos_id_cliente_fkey(nome, whatsapp), profissionais(nome), servicos(nome)',
      )
      .gte('data_hora_inicio', inicioHoje.toISOString())
      .lte('data_hora_inicio', fimHoje.toISOString())
      .neq('status', 'cancelado')
      .order('data_hora_inicio')
      .then(({ data }) => {
        if (!ativo) return
        const mapeados: AgendamentoHoje[] = (data ?? []).map((linha) => {
          const item = linha as unknown as {
            id: string
            data_hora_inicio: string
            id_cliente: string
            id_profissional: string
            crm_naildesigner: { nome: string | null; whatsapp: string } | null
            profissionais: { nome: string } | null
            servicos: { nome: string } | null
          }
          return {
            id: item.id,
            cliente_id: item.id_cliente,
            cliente_nome: item.crm_naildesigner?.nome || item.crm_naildesigner?.whatsapp || 'Cliente',
            profissional_id: item.id_profissional,
            profissional_nome: item.profissionais?.nome ?? '—',
            servico_nome: item.servicos?.nome ?? '—',
            hora: format(new Date(item.data_hora_inicio), 'HH:mm'),
          }
        })
        setAgendamentosHoje(mapeados)
        setCarregandoAgendamentos(false)
      })

    return () => {
      ativo = false
    }
  }, [aberto, modo])

  async function criar() {
    setErro(null)

    let idCliente: string
    let idProfissional: string
    let idAgendamento: string | null = null

    if (modo === MODO_AGENDAMENTO) {
      if (!agendamentoSelecionado) {
        setErro('Selecione um agendamento de hoje.')
        return
      }
      idCliente = agendamentoSelecionado.cliente_id
      idProfissional = agendamentoSelecionado.profissional_id
      idAgendamento = agendamentoSelecionado.id
    } else {
      if (!cliente) {
        setErro('Selecione ou cadastre o cliente.')
        return
      }
      if (!profissionalId) {
        setErro('Selecione a profissional responsável.')
        return
      }
      idCliente = cliente.id
      idProfissional = profissionalId
    }

    setSalvando(true)

    const dadosNovos = {
      id_cliente: idCliente,
      id_profissional: idProfissional,
      id_agendamento: idAgendamento,
      status: 'aberta' as const,
    }

    const { data, error } = await supabase.from('comandas').insert(dadosNovos).select().single()

    setSalvando(false)

    if (error || !data) {
      setErro('Não foi possível criar a comanda: ' + error?.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'criar_comanda',
      tabela: 'comandas',
      idRegistro: data.id,
      dadosNovos,
    })

    onCriada(data.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova comanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setModo(MODO_BUSCA)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                modo === MODO_BUSCA ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground'
              }`}
            >
              Buscar cliente
            </button>
            <button
              type="button"
              onClick={() => setModo(MODO_AGENDAMENTO)}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                modo === MODO_AGENDAMENTO ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground'
              }`}
            >
              Agendamento de hoje
            </button>
          </div>

          {modo === MODO_BUSCA ? (
            <>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <ClienteBuscaCampo clienteSelecionado={cliente} onSelecionar={setCliente} />
              </div>
              <div className="space-y-2">
                <Label>Profissional responsável</Label>
                <Select value={profissionalId} onValueChange={setProfissionalId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {profissionais.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>Agendamentos de hoje</Label>
              {carregandoAgendamentos && (
                <p className="text-sm text-muted-foreground">Carregando agendamentos...</p>
              )}
              {!carregandoAgendamentos && agendamentosHoje.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum agendamento para hoje.</p>
              )}
              {!carregandoAgendamentos && agendamentosHoje.length > 0 && (
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {agendamentosHoje.map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => setAgendamentoSelecionado(ag)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                        agendamentoSelecionado?.id === ag.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-background hover:bg-muted'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-foreground">{ag.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {ag.profissional_nome} · {ag.servico_nome}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{ag.hora}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {erro && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={criar} disabled={salvando}>
            {salvando ? 'Criando...' : 'Criar comanda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
