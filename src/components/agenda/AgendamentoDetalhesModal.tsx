import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { validarDisponibilidade } from '@/lib/disponibilidade'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Profissional } from '@/types/database'
import type { EventoAgenda } from './tipos'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface AgendamentoDetalhesModalProps {
  evento: EventoAgenda | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  profissionais: Profissional[]
  onAtualizado: () => void
}

const ROTULOS_STATUS: Record<string, { texto: string; variante: 'default' | 'accent' | 'outline' | 'destructive' }> = {
  agendado: { texto: 'Agendado', variante: 'default' },
  confirmado: { texto: 'Confirmado', variante: 'accent' },
  concluido: { texto: 'Concluído', variante: 'outline' },
  cancelado: { texto: 'Cancelado', variante: 'destructive' },
}

export default function AgendamentoDetalhesModal({
  evento,
  aberto,
  onOpenChange,
  profissionais,
  onAtualizado,
}: AgendamentoDetalhesModalProps) {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!evento) return
    setData(format(evento.start, 'yyyy-MM-dd'))
    setHoraInicio(format(evento.start, 'HH:mm'))
    setErro(null)
  }, [evento])

  if (!evento) return null

  const alterado = format(evento.start, 'yyyy-MM-dd') !== data || format(evento.start, 'HH:mm') !== horaInicio
  const editavel = evento.agendamento.status === 'agendado' || evento.agendamento.status === 'confirmado'
  const rotuloStatus = ROTULOS_STATUS[evento.agendamento.status]

  async function remarcar() {
    const profissional = profissionais.find((p) => p.id === evento!.agendamento.id_profissional)
    if (!profissional) return

    const novoInicio = new Date(`${data}T${horaInicio}:00`)
    const duracaoMs = evento!.end.getTime() - evento!.start.getTime()
    const novoFim = new Date(novoInicio.getTime() + duracaoMs)

    const avisoDisponibilidade = validarDisponibilidade(profissional, novoInicio, novoFim)
    if (avisoDisponibilidade) {
      setErro(avisoDisponibilidade)
      return
    }

    setSalvando(true)
    setErro(null)

    const { error } = await supabase
      .from('agendamentos')
      .update({ data_hora_inicio: novoInicio.toISOString(), data_hora_fim: novoFim.toISOString() })
      .eq('id', evento!.agendamento.id)

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'remarcar_agendamento',
      tabela: 'agendamentos',
      idRegistro: evento!.agendamento.id,
      dadosAnteriores: { data_hora_inicio: evento!.agendamento.data_hora_inicio },
      dadosNovos: { data_hora_inicio: novoInicio.toISOString() },
    })

    onAtualizado()
    onOpenChange(false)
  }

  async function atualizarStatus(novoStatus: 'cancelado' | 'concluido') {
    if (novoStatus === 'cancelado') {
      const confirmado = await confirmarExclusao({
        titulo: 'Cancelar agendamento',
        descricao: `Deseja realmente cancelar o agendamento de ${evento!.clienteNome}?`,
        textoConfirmar: 'Cancelar agendamento',
        textoCancelar: 'Voltar',
      })
      if (!confirmado) return
    }

    setSalvando(true)
    setErro(null)

    const { error } = await supabase
      .from('agendamentos')
      .update({ status: novoStatus })
      .eq('id', evento!.agendamento.id)

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: novoStatus === 'cancelado' ? 'cancelar_agendamento' : 'concluir_agendamento',
      tabela: 'agendamentos',
      idRegistro: evento!.agendamento.id,
      dadosAnteriores: { status: evento!.agendamento.status },
      dadosNovos: { status: novoStatus },
    })

    onAtualizado()
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{evento.clienteNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm">
            <div>
              <p className="font-medium text-foreground">{evento.servicoNome}</p>
              <p className="text-muted-foreground">{evento.profissionalNome}</p>
            </div>
            {rotuloStatus && <Badge variant={rotuloStatus.variante}>{rotuloStatus.texto}</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="data-remarcar">Data</Label>
              <Input
                id="data-remarcar"
                type="date"
                value={data}
                disabled={!editavel}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora-remarcar">Horário de início</Label>
              <Input
                id="hora-remarcar"
                type="time"
                value={horaInicio}
                disabled={!editavel}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
          </div>

          {erro && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}
        </div>

        <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
          {editavel ? (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => atualizarStatus('cancelado')} disabled={salvando}>
                Cancelar agendamento
              </Button>
              <Button variant="outline" size="sm" onClick={() => atualizarStatus('concluido')} disabled={salvando}>
                Marcar como concluído
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">
              Este agendamento não pode mais ser alterado.
            </span>
          )}

          {editavel && (
            <Button onClick={remarcar} disabled={salvando || !alterado}>
              {salvando ? 'Salvando...' : 'Salvar novo horário'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
