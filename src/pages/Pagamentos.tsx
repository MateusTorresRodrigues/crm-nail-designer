import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataHora, formatarValor } from '@/lib/date'
import type { Pagamento, StatusPagamento } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PagamentoComNomes extends Pagamento {
  clienteNome: string
  dataAgendamento: string | null
}

const FILTROS: { valor: StatusPagamento | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'falhou', rotulo: 'Falhou' },
  { valor: 'estornado', rotulo: 'Estornado' },
]

const BADGE_STATUS: Record<StatusPagamento, { texto: string; className: string }> = {
  pago: { texto: 'Pago', className: 'bg-accent/20 text-accent' },
  pendente: { texto: 'Pendente', className: 'bg-amber-500/15 text-amber-700' },
  falhou: { texto: 'Falhou', className: 'bg-destructive/15 text-destructive' },
  estornado: { texto: 'Estornado', className: 'bg-muted text-muted-foreground' },
}

const ROTULO_FORMA: Record<string, string> = { pix: 'Pix', cartao: 'Cartão' }

export default function Pagamentos() {
  const [pagamentos, setPagamentos] = useState<PagamentoComNomes[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtro, setFiltro] = useState<StatusPagamento | 'todos'>('todos')
  const [selecionado, setSelecionado] = useState<PagamentoComNomes | null>(null)

  async function carregar() {
    setCarregando(true)

    const { data } = await supabase
      .from('pagamentos')
      .select(
        '*, agendamentos(data_hora_inicio, crm_naildesigner!agendamentos_id_cliente_fkey(nome, whatsapp))',
      )
      .order('created_at', { ascending: false })

    const mapeados: PagamentoComNomes[] = (data ?? []).map((linha) => {
      const item = linha as unknown as Pagamento & {
        agendamentos: {
          data_hora_inicio: string
          crm_naildesigner: { nome: string | null; whatsapp: string } | null
        } | null
      }
      return {
        ...item,
        clienteNome: item.agendamentos?.crm_naildesigner?.nome || item.agendamentos?.crm_naildesigner?.whatsapp || '—',
        dataAgendamento: item.agendamentos?.data_hora_inicio ?? null,
      }
    })

    setPagamentos(mapeados)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const listaFiltrada = filtro === 'todos' ? pagamentos : pagamentos.filter((p) => p.status === filtro)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 w-fit">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              filtro === f.valor ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground',
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && <p className="px-4 py-6 text-sm text-muted-foreground">Carregando pagamentos...</p>}

          {!carregando && listaFiltrada.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento {filtro !== 'todos' ? `com status "${FILTROS.find((f) => f.valor === filtro)?.rotulo.toLowerCase()}"` : ''} encontrado.
              </p>
            </div>
          )}

          {!carregando && listaFiltrada.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Agendamento</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((pagamento) => {
                  const badge = BADGE_STATUS[pagamento.status]
                  return (
                    <tr
                      key={pagamento.id}
                      onClick={() => setSelecionado(pagamento)}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{pagamento.clienteNome}</td>
                      <td className="px-4 py-3">{formatarValor(pagamento.valor)}</td>
                      <td className="px-4 py-3">
                        <Badge className={badge.className}>{badge.texto}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatarDataHora(pagamento.dataAgendamento)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatarDataHora(pagamento.created_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selecionado} onOpenChange={(aberto) => !aberto && setSelecionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selecionado?.clienteNome}</DialogTitle>
          </DialogHeader>

          {selecionado && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5">
                <div>
                  <p className="font-medium text-foreground">{formatarValor(selecionado.valor)}</p>
                  <p className="text-muted-foreground">{selecionado.descricao ?? 'Sinal do agendamento'}</p>
                </div>
                <Badge className={BADGE_STATUS[selecionado.status].className}>
                  {BADGE_STATUS[selecionado.status].texto}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Forma de pagamento</p>
                  <p className="text-foreground">
                    {selecionado.forma_pagamento ? ROTULO_FORMA[selecionado.forma_pagamento] : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Agendamento</p>
                  <p className="text-foreground">{formatarDataHora(selecionado.dataAgendamento)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">ID externo (Asaas)</p>
                  <code className="text-xs text-foreground">{selecionado.id_externo ?? '—'}</code>
                </div>
              </div>

              {selecionado.status === 'pendente' && selecionado.link_pagamento && (
                <Button asChild className="w-full">
                  <a href={selecionado.link_pagamento} target="_blank" rel="noreferrer">
                    Abrir link de pagamento
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
