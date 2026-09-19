import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Undo2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarData, diasEntre } from '@/lib/date'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { useCadastrosApoio } from '@/hooks/useCadastrosApoio'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface UltimoAtendimento {
  data: string
  profissionalId: string
  profissionalNome: string
  servicoNome: string
  diasRetorno: number | null
}

interface ClienteRetorno {
  id: string
  nome: string
  whatsapp: string
  ultimoAtendimento: UltimoAtendimento
  diasDesde: number
  prazoAplicavel: number
  situacao: 'atrasado' | 'proximo'
}

const TODAS = '__todas__'
const LIMITE_PROXIMO = 3

export default function Retorno() {
  const { configuracao } = useConfiguracao()
  const { profissionais } = useCadastrosApoio()

  const [clientes, setClientes] = useState<ClienteRetorno[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroProfissional, setFiltroProfissional] = useState(TODAS)

  useEffect(() => {
    if (!configuracao) return
    const diasInatividadePadrao = configuracao.dias_inatividade

    let ativo = true
    setCarregando(true)

    async function carregar() {
      const [respClientes, respAgendamentos, respComandas] = await Promise.all([
        supabase.from('crm_naildesigner').select('id, nome, whatsapp').eq('tipo', 'cliente'),
        supabase
          .from('agendamentos')
          .select(
            'id_cliente, id_profissional, data_hora_inicio, profissionais(nome), servicos(nome, dias_retorno)',
          )
          .eq('status', 'concluido'),
        supabase
          .from('comandas')
          .select(
            'id, id_cliente, id_profissional, id_agendamento, created_at, profissionais(nome), agendamentos(id_servico, servicos(nome, dias_retorno))',
          )
          .eq('status', 'fechada'),
      ])

      if (!ativo) return

      const clientesBase = respClientes.data ?? []

      const comandasSemAgendamento = (respComandas.data ?? []).filter(
        (c) => !(c as unknown as { id_agendamento: string | null }).id_agendamento,
      )
      const idsComandasSemAgendamento = comandasSemAgendamento.map((c) => (c as unknown as { id: string }).id)

      let itensPorComanda = new Map<string, { nome: string; dias_retorno: number | null }>()
      if (idsComandasSemAgendamento.length > 0) {
        const { data: itens } = await supabase
          .from('itens_comanda')
          .select('id_comanda, created_at, servicos(nome, dias_retorno)')
          .in('id_comanda', idsComandasSemAgendamento)
          .not('id_servico', 'is', null)
          .order('created_at')

        for (const item of itens ?? []) {
          const linha = item as unknown as {
            id_comanda: string
            servicos: { nome: string; dias_retorno: number | null } | null
          }
          if (!linha.servicos) continue
          if (!itensPorComanda.has(linha.id_comanda)) {
            itensPorComanda.set(linha.id_comanda, linha.servicos)
          }
        }
      }

      const eventosPorCliente = new Map<string, UltimoAtendimento[]>()

      function registrarEvento(idCliente: string, evento: UltimoAtendimento) {
        const lista = eventosPorCliente.get(idCliente) ?? []
        lista.push(evento)
        eventosPorCliente.set(idCliente, lista)
      }

      for (const linha of respAgendamentos.data ?? []) {
        const item = linha as unknown as {
          id_cliente: string
          id_profissional: string
          data_hora_inicio: string
          profissionais: { nome: string } | null
          servicos: { nome: string; dias_retorno: number | null } | null
        }
        registrarEvento(item.id_cliente, {
          data: item.data_hora_inicio,
          profissionalId: item.id_profissional,
          profissionalNome: item.profissionais?.nome ?? '—',
          servicoNome: item.servicos?.nome ?? '—',
          diasRetorno: item.servicos?.dias_retorno ?? null,
        })
      }

      for (const linha of respComandas.data ?? []) {
        const item = linha as unknown as {
          id: string
          id_cliente: string
          id_profissional: string
          id_agendamento: string | null
          created_at: string
          profissionais: { nome: string } | null
          agendamentos: { id_servico: string; servicos: { nome: string; dias_retorno: number | null } | null } | null
        }

        const servicoDoAgendamento = item.agendamentos?.servicos
        const servicoDoItem = itensPorComanda.get(item.id)
        const servico = servicoDoAgendamento ?? servicoDoItem ?? null

        registrarEvento(item.id_cliente, {
          data: item.created_at,
          profissionalId: item.id_profissional,
          profissionalNome: item.profissionais?.nome ?? '—',
          servicoNome: servico?.nome ?? '—',
          diasRetorno: servico?.dias_retorno ?? null,
        })
      }

      const hoje = new Date()
      const resultado: ClienteRetorno[] = []

      for (const cliente of clientesBase) {
        const eventos = eventosPorCliente.get(cliente.id)
        if (!eventos || eventos.length === 0) continue

        const ultimoAtendimento = eventos.reduce((a, b) => (new Date(a.data) > new Date(b.data) ? a : b))

        const diasDesde = diasEntre(ultimoAtendimento.data, hoje)
        const prazoAplicavel = ultimoAtendimento.diasRetorno ?? diasInatividadePadrao
        const diferenca = diasDesde - prazoAplicavel

        let situacao: 'atrasado' | 'proximo' | null = null
        if (diferenca > 0) situacao = 'atrasado'
        else if (diferenca >= -LIMITE_PROXIMO) situacao = 'proximo'

        if (!situacao) continue

        resultado.push({
          id: cliente.id,
          nome: cliente.nome || cliente.whatsapp,
          whatsapp: cliente.whatsapp,
          ultimoAtendimento,
          diasDesde,
          prazoAplicavel,
          situacao,
        })
      }

      resultado.sort((a, b) => (b.diasDesde - b.prazoAplicavel) - (a.diasDesde - a.prazoAplicavel))

      setClientes(resultado)
      setCarregando(false)
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [configuracao])

  const clientesFiltrados = useMemo(() => {
    if (filtroProfissional === TODAS) return clientes
    return clientes.filter((c) => c.ultimoAtendimento.profissionalId === filtroProfissional)
  }, [clientes, filtroProfissional])

  function abrirWhatsapp(whatsapp: string) {
    const numero = whatsapp.replace(/\D/g, '')
    window.open(`https://wa.me/${numero}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Clientes cujo prazo de retorno está próximo ou já passou, dos mais atrasados aos mais próximos.
        </p>
        <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas as profissionais</SelectItem>
            {profissionais.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Calculando retornos...</p>
          )}

          {!carregando && clientesFiltrados.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Undo2 className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Nenhum cliente para retorno no momento</p>
              <p className="text-sm text-muted-foreground">
                Assim que um prazo de retorno se aproximar ou vencer, os clientes aparecerão aqui.
              </p>
            </div>
          )}

          {!carregando && clientesFiltrados.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">WhatsApp</th>
                    <th className="px-5 py-3 font-medium">Profissional</th>
                    <th className="px-5 py-3 font-medium">Último serviço</th>
                    <th className="px-5 py-3 font-medium">Último atendimento</th>
                    <th className="px-5 py-3 font-medium">Dias desde</th>
                    <th className="px-5 py-3 font-medium">Prazo</th>
                    <th className="px-5 py-3 font-medium">Situação</th>
                    <th className="px-5 py-3 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente) => (
                    <tr key={cliente.id} className="border-b border-border/60 last:border-0 hover:bg-muted/60">
                      <td className="px-5 py-3 font-medium text-foreground">{cliente.nome}</td>
                      <td className="px-5 py-3 text-muted-foreground">{cliente.whatsapp}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {cliente.ultimoAtendimento.profissionalNome}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {cliente.ultimoAtendimento.servicoNome}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatarData(cliente.ultimoAtendimento.data)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{cliente.diasDesde} dias</td>
                      <td className="px-5 py-3 text-muted-foreground">{cliente.prazoAplicavel} dias</td>
                      <td className="px-5 py-3">
                        <Badge variant={cliente.situacao === 'atrasado' ? 'destructive' : 'accent'}>
                          {cliente.situacao === 'atrasado' ? 'Atrasado' : 'Próximo'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => abrirWhatsapp(cliente.whatsapp)}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Abrir WhatsApp
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
