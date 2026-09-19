import { useEffect, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataHora, formatarValor } from '@/lib/date'
import { useCadastrosApoio } from '@/hooks/useCadastrosApoio'
import type { Comanda } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import NovaComandaModal from '@/components/comandas/NovaComandaModal'
import ComandaDrawer from '@/components/comandas/ComandaDrawer'

interface ComandaComNomes extends Comanda {
  clienteNome: string
  profissionalNome: string
}

const ABA_ABERTAS = 'aberta'
const ABA_FECHADAS = 'fechada'

export default function Comandas() {
  const { profissionais, servicos, produtos, recarregar } = useCadastrosApoio()

  const [comandas, setComandas] = useState<ComandaComNomes[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState<typeof ABA_ABERTAS | typeof ABA_FECHADAS>(ABA_ABERTAS)

  const [novaAberta, setNovaAberta] = useState(false)
  const [comandaSelecionadaId, setComandaSelecionadaId] = useState<string | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)

  async function carregar() {
    setCarregando(true)

    const { data } = await supabase
      .from('comandas')
      .select('*, crm_naildesigner!comandas_id_cliente_fkey(nome, whatsapp), profissionais(nome)')
      .order('created_at', { ascending: false })

    const mapeadas: ComandaComNomes[] = (data ?? []).map((linha) => {
      const item = linha as unknown as Comanda & {
        crm_naildesigner: { nome: string | null; whatsapp: string } | null
        profissionais: { nome: string } | null
      }
      return {
        ...item,
        clienteNome: item.crm_naildesigner?.nome || item.crm_naildesigner?.whatsapp || 'Cliente',
        profissionalNome: item.profissionais?.nome ?? '—',
      }
    })

    setComandas(mapeadas)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  const comandasFiltradas = comandas.filter((c) => c.status === aba)

  function abrirComanda(id: string) {
    setComandaSelecionadaId(id)
    setDrawerAberto(true)
  }

  function lidarComComandaCriada(id: string) {
    carregar()
    abrirComanda(id)
  }

  function lidarComAlteracao() {
    carregar()
    recarregar()
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 rounded-xl bg-muted p-1">
          <button
            onClick={() => setAba(ABA_ABERTAS)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              aba === ABA_ABERTAS ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground',
            )}
          >
            Abertas
          </button>
          <button
            onClick={() => setAba(ABA_FECHADAS)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              aba === ABA_FECHADAS ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground',
            )}
          >
            Fechadas
          </button>
        </div>

        <Button onClick={() => setNovaAberta(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova comanda
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando comandas...</p>
          )}

          {!carregando && comandasFiltradas.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">
                {aba === ABA_ABERTAS ? 'Nenhuma comanda aberta no momento' : 'Nenhuma comanda fechada ainda'}
              </p>
              <p className="text-sm text-muted-foreground">
                {aba === ABA_ABERTAS
                  ? 'Abra uma nova comanda para começar a lançar itens de um atendimento.'
                  : 'Comandas fechadas aparecerão aqui.'}
              </p>
            </div>
          )}

          {!carregando && comandasFiltradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Profissional</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Valor total</th>
                    <th className="px-5 py-3 font-medium">Abertura</th>
                  </tr>
                </thead>
                <tbody>
                  {comandasFiltradas.map((comanda) => (
                    <tr
                      key={comanda.id}
                      onClick={() => abrirComanda(comanda.id)}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{comanda.clienteNome}</td>
                      <td className="px-5 py-3 text-muted-foreground">{comanda.profissionalNome}</td>
                      <td className="px-5 py-3">
                        <Badge variant={comanda.status === 'aberta' ? 'default' : 'outline'}>
                          {comanda.status === 'aberta' ? 'Aberta' : 'Fechada'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatarValor(comanda.valor_total)}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatarDataHora(comanda.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaComandaModal
        aberto={novaAberta}
        onOpenChange={setNovaAberta}
        profissionais={profissionais}
        onCriada={lidarComComandaCriada}
      />

      <ComandaDrawer
        comandaId={comandaSelecionadaId}
        aberto={drawerAberto}
        onOpenChange={(aberto) => {
          setDrawerAberto(aberto)
          if (!aberto) lidarComAlteracao()
        }}
        servicos={servicos}
        produtos={produtos}
        onAlterada={lidarComAlteracao}
      />
    </div>
  )
}
