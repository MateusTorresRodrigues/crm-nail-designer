import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { validarDisponibilidade } from '@/lib/disponibilidade'
import { useAuth } from '@/contexts/AuthContext'
import type { Contato, Profissional, Servico } from '@/types/database'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ClienteBuscaCampo from './ClienteBuscaCampo'

interface SlotInicial {
  inicio: Date
  fim: Date
  profissionalId?: string
}

interface NovoAgendamentoModalProps {
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  slot: SlotInicial | null
  profissionais: Profissional[]
  servicos: Servico[]
  onCriado: () => void
}

export default function NovoAgendamentoModal({
  aberto,
  onOpenChange,
  slot,
  profissionais,
  servicos,
  onCriado,
}: NovoAgendamentoModalProps) {
  const { user } = useAuth()

  const [cliente, setCliente] = useState<Contato | null>(null)
  const [profissionalId, setProfissionalId] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao'>('pix')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [agendamentoCriado, setAgendamentoCriado] = useState(false)
  const [gerandoSinal, setGerandoSinal] = useState(false)
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null)
  const [erroSinal, setErroSinal] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setCliente(null)
    setProfissionalId(slot?.profissionalId ?? '')
    setServicoId('')
    setData(slot ? format(slot.inicio, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setHoraInicio(slot ? format(slot.inicio, 'HH:mm') : '09:00')
    setFormaPagamento('pix')
    setCpfCnpj('')
    setErro(null)
    setAgendamentoCriado(false)
    setLinkPagamento(null)
    setErroSinal(null)
  }, [aberto, slot])

  const servico = servicos.find((s) => s.id === servicoId)
  const profissional = profissionais.find((p) => p.id === profissionalId)

  function calcularHorarios() {
    if (!data || !horaInicio || !servico) return null
    const inicio = new Date(`${data}T${horaInicio}:00`)
    const fim = new Date(inicio.getTime() + servico.duracao_minutos * 60000)
    return { inicio, fim }
  }

  const horarios = calcularHorarios()

  async function salvar() {
    if (!cliente) {
      setErro('Selecione ou cadastre o cliente.')
      return
    }
    if (!profissionalId) {
      setErro('Selecione a profissional.')
      return
    }
    if (!servicoId || !horarios) {
      setErro('Selecione o serviço e o horário.')
      return
    }
    if (!profissional) {
      setErro('Profissional inválida.')
      return
    }

    const avisoDisponibilidade = validarDisponibilidade(profissional, horarios.inicio, horarios.fim)
    if (avisoDisponibilidade) {
      setErro(avisoDisponibilidade)
      return
    }

    setSalvando(true)
    setErro(null)

    const dadosNovos = {
      id_cliente: cliente.id,
      id_profissional: profissionalId,
      id_servico: servicoId,
      data_hora_inicio: horarios.inicio.toISOString(),
      data_hora_fim: horarios.fim.toISOString(),
      status: 'agendado' as const,
    }

    const { data: criado, error } = await supabase
      .from('agendamentos')
      .insert(dadosNovos)
      .select()
      .single()

    setSalvando(false)

    if (error || !criado) {
      setErro(error?.message ?? 'Não foi possível criar o agendamento.')
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'criar_agendamento',
      tabela: 'agendamentos',
      idRegistro: criado.id,
      dadosNovos,
    })

    setAgendamentoCriado(true)
    onCriado()

    setGerandoSinal(true)
    const { data: resultado, error: erroFuncao } = await supabase.functions.invoke('pagamentos', {
      body: { id_agendamento: criado.id, forma_pagamento: formaPagamento, cpf_cnpj: cpfCnpj.trim() || undefined },
    })
    setGerandoSinal(false)

    if (erroFuncao || !resultado?.sucesso) {
      let mensagem = resultado?.mensagem ?? erroFuncao?.message ?? 'Não foi possível gerar o link de pagamento.'
      const contexto = (erroFuncao as { context?: Response })?.context
      if (contexto) {
        const corpo = await contexto
          .clone()
          .json()
          .catch(() => null)
        if (corpo?.mensagem) mensagem = corpo.mensagem
      }
      setErroSinal(mensagem)
      return
    }

    setLinkPagamento(resultado.link_pagamento ?? null)
  }

  function fechar() {
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>

        {!agendamentoCriado ? (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <ClienteBuscaCampo clienteSelecionado={cliente} onSelecionar={setCliente} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Profissional</Label>
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
                <div className="space-y-2">
                  <Label>Serviço</Label>
                  <Select value={servicoId} onValueChange={setServicoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {servicos.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} ({s.duracao_minutos} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="data-agendamento">Data</Label>
                  <Input id="data-agendamento" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hora-agendamento">Horário de início</Label>
                  <Input
                    id="hora-agendamento"
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                  />
                </div>
              </div>

              {horarios && servico && (
                <p className="text-sm text-muted-foreground">
                  Término previsto às {format(horarios.fim, 'HH:mm')} ({servico.duracao_minutos} minutos)
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Forma de pagamento do sinal</Label>
                  <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as 'pix' | 'cartao')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf-cnpj">CPF/CNPJ do cliente</Label>
                  <Input
                    id="cpf-cnpj"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder="Necessário para gerar a cobrança"
                  />
                </div>
              </div>

              {erro && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Criar agendamento'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent">
                Agendamento criado com sucesso.
              </p>

              {gerandoSinal && <p className="text-sm text-muted-foreground">Gerando link de pagamento do sinal...</p>}

              {!gerandoSinal && linkPagamento && (
                <div className="space-y-2">
                  <Label>Link de pagamento do sinal</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={linkPagamento} />
                    <Button variant="outline" asChild>
                      <a href={linkPagamento} target="_blank" rel="noreferrer">
                        Abrir
                      </a>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Envie este link ao cliente para confirmar o sinal.</p>
                </div>
              )}

              {!gerandoSinal && erroSinal && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Agendamento criado, mas não foi possível gerar o link de pagamento: {erroSinal}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button onClick={fechar}>Fechar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
