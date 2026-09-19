import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { calcularIntervalo, diaSemanaChave, type PeriodoPreset } from '@/lib/periodo'
import { STATUS } from '@/lib/paleta-graficos'
import FiltroPeriodo from '@/components/dashboard/FiltroPeriodo'
import CardIndicador from '@/components/dashboard/CardIndicador'
import CartaoGrafico from '@/components/dashboard/CartaoGrafico'
import GraficoMovimentoDia, { type PontoMovimentoHora } from '@/components/dashboard/GraficoMovimentoDia'
import GraficoLinhaWhatsapp, { type PontoContatosDia } from '@/components/dashboard/GraficoLinhaWhatsapp'
import GraficoDiasSemana, { type PontoDiaSemana } from '@/components/dashboard/GraficoDiasSemana'
import GraficoPorProfissional, { type PontoProfissional } from '@/components/dashboard/GraficoPorProfissional'
import GraficoServicosMaisVendidos, {
  type PontoServico,
} from '@/components/dashboard/GraficoServicosMaisVendidos'
import { Badge } from '@/components/ui/badge'

const DIAS_SEMANA_ROTULOS: Record<string, string> = {
  dom: 'Dom',
  seg: 'Seg',
  ter: 'Ter',
  qua: 'Qua',
  qui: 'Qui',
  sex: 'Sex',
  sab: 'Sáb',
}
const ORDEM_DIAS_SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

const ROTULOS_STATUS_AGENDAMENTO: Record<string, string> = {
  agendado: 'Agendado',
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  concluido: 'Concluído',
}

interface AgendamentoHojeLinha {
  status: string
  data_hora_inicio: string
}

interface ContatoLinha {
  id: string
  tipo: string
  created_at: string
  updated_at: string
}

interface ComandaFechadaLinha {
  id: string
  id_profissional: string
  valor_total: number
  updated_at: string
}

export default function Dashboard() {
  const { configuracao, nomeNegocio } = useConfiguracao()

  const [preset, setPreset] = useState<PeriodoPreset>('7dias')
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'))

  const intervalo = useMemo(
    () => calcularIntervalo(preset, { inicio: dataInicio, fim: dataFim }),
    [preset, dataInicio, dataFim],
  )

  const [carregando, setCarregando] = useState(true)

  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoHojeLinha[]>([])
  const [contatos, setContatos] = useState<ContatoLinha[]>([])
  const [comandasFechadas, setComandasFechadas] = useState<ComandaFechadaLinha[]>([])
  const [profissionaisNomes, setProfissionaisNomes] = useState<Map<string, string>>(new Map())
  const [servicosVendidos, setServicosVendidos] = useState<PontoServico[]>([])

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    async function carregar() {
      const hoje = new Date()
      const inicioHoje = new Date(hoje)
      inicioHoje.setHours(0, 0, 0, 0)
      const fimHoje = new Date(hoje)
      fimHoje.setHours(23, 59, 59, 999)

      const [
        respAgendamentosHoje,
        respContatos,
        respComandasFechadas,
        respProfissionais,
        respItensComanda,
      ] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('status, data_hora_inicio')
          .gte('data_hora_inicio', inicioHoje.toISOString())
          .lte('data_hora_inicio', fimHoje.toISOString()),
        supabase.from('crm_naildesigner').select('id, tipo, created_at, updated_at'),
        supabase
          .from('comandas')
          .select('id, id_profissional, valor_total, updated_at')
          .eq('status', 'fechada'),
        supabase.from('profissionais').select('id, nome'),
        supabase
          .from('itens_comanda')
          .select('quantidade, valor_total, created_at, servicos(nome)')
          .not('id_servico', 'is', null)
          .gte('created_at', intervalo.inicio.toISOString())
          .lte('created_at', intervalo.fim.toISOString()),
      ])

      if (!ativo) return

      setAgendamentosHoje(respAgendamentosHoje.data ?? [])
      setContatos(respContatos.data ?? [])
      setComandasFechadas(respComandasFechadas.data ?? [])

      const mapaProfissionais = new Map<string, string>()
      for (const p of respProfissionais.data ?? []) mapaProfissionais.set(p.id, p.nome)
      setProfissionaisNomes(mapaProfissionais)

      const porServico = new Map<string, PontoServico>()
      for (const linha of respItensComanda.data ?? []) {
        const item = linha as unknown as {
          quantidade: number
          valor_total: number
          servicos: { nome: string } | null
        }
        const nome = item.servicos?.nome
        if (!nome) continue
        const atual = porServico.get(nome) ?? { nome, quantidade: 0, valorTotal: 0 }
        atual.quantidade += item.quantidade
        atual.valorTotal += item.valor_total
        porServico.set(nome, atual)
      }
      const listaServicos = Array.from(porServico.values()).sort((a, b) => b.quantidade - a.quantidade)
      setServicosVendidos(listaServicos)

      setCarregando(false)
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [intervalo])

  // --- Agendamentos do dia (sempre hoje, independente do filtro de período) ---
  const totalAgendamentosHoje = agendamentosHoje.length
  const breakdownStatus = useMemo(() => {
    const contagem: Record<string, number> = { agendado: 0, confirmado: 0, cancelado: 0, concluido: 0 }
    for (const a of agendamentosHoje) {
      if (a.status in contagem) contagem[a.status] += 1
    }
    return contagem
  }, [agendamentosHoje])

  // --- Contatos recebidos e clientes novos no período ---
  const contatosNoPeriodo = useMemo(
    () =>
      contatos.filter((c) => {
        const data = new Date(c.created_at)
        return data >= intervalo.inicio && data <= intervalo.fim
      }),
    [contatos, intervalo],
  )

  const clientesNovosNoPeriodo = useMemo(() => {
    return contatos.filter((c) => {
      if (c.tipo !== 'cliente') return false
      const criado = new Date(c.created_at)
      const atualizado = new Date(c.updated_at)
      const dataConversao = atualizado.getTime() - criado.getTime() > 5000 ? atualizado : criado
      return dataConversao >= intervalo.inicio && dataConversao <= intervalo.fim
    }).length
  }, [contatos, intervalo])

  // --- Movimento do dia (agendamentos + comandas fechadas por hora, hoje) ---
  const horasFuncionamento = useMemo(() => {
    const diaHoje = diaSemanaChave(new Date())
    const intervaloConfigurado = configuracao?.horario_funcionamento?.[diaHoje]
    if (intervaloConfigurado) {
      const inicio = Number(intervaloConfigurado.inicio.split(':')[0])
      const fim = Number(intervaloConfigurado.fim.split(':')[0])
      if (!Number.isNaN(inicio) && !Number.isNaN(fim) && fim > inicio) {
        return { inicio, fim }
      }
    }
    return { inicio: 8, fim: 20 }
  }, [configuracao])

  const movimentoDia: PontoMovimentoHora[] = useMemo(() => {
    const hoje = new Date()
    const pontos: PontoMovimentoHora[] = []
    for (let h = horasFuncionamento.inicio; h <= horasFuncionamento.fim; h++) {
      pontos.push({ hora: String(h), agendamentos: 0, valorComandas: 0 })
    }
    const indicePorHora = new Map(pontos.map((p, i) => [Number(p.hora), i]))

    for (const a of agendamentosHoje) {
      const data = new Date(a.data_hora_inicio)
      const indice = indicePorHora.get(data.getHours())
      if (indice !== undefined) pontos[indice].agendamentos += 1
    }

    for (const c of comandasFechadas) {
      const data = new Date(c.updated_at)
      const mesmodia =
        data.getFullYear() === hoje.getFullYear() &&
        data.getMonth() === hoje.getMonth() &&
        data.getDate() === hoje.getDate()
      if (!mesmodia) continue
      const indice = indicePorHora.get(data.getHours())
      if (indice !== undefined) pontos[indice].valorComandas += c.valor_total
    }

    return pontos
  }, [agendamentosHoje, comandasFechadas, horasFuncionamento])

  // --- Contatos por dia no período (linha) ---
  const contatosPorDia: PontoContatosDia[] = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const c of contatosNoPeriodo) {
      const chave = format(new Date(c.created_at), 'yyyy-MM-dd')
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1)
    }
    const dias: PontoContatosDia[] = []
    const cursor = new Date(intervalo.inicio)
    while (cursor <= intervalo.fim) {
      const chave = format(cursor, 'yyyy-MM-dd')
      dias.push({ data: chave, rotulo: format(cursor, 'dd/MM'), contatos: mapa.get(chave) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return dias
  }, [contatosNoPeriodo, intervalo])

  // --- Dias da semana com mais contatos (histórico completo) ---
  const diasComMaisContatos: PontoDiaSemana[] = useMemo(() => {
    const contagem: Record<string, number> = { dom: 0, seg: 0, ter: 0, qua: 0, qui: 0, sex: 0, sab: 0 }
    for (const c of contatos) {
      contagem[diaSemanaChave(new Date(c.created_at))] += 1
    }
    return ORDEM_DIAS_SEMANA.map((chave) => ({ rotulo: DIAS_SEMANA_ROTULOS[chave], contatos: contagem[chave] }))
  }, [contatos])

  // --- Atendimentos por profissional no período ---
  const atendimentosPorProfissional: PontoProfissional[] = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const c of comandasFechadas) {
      const data = new Date(c.updated_at)
      if (data < intervalo.inicio || data > intervalo.fim) continue
      contagem.set(c.id_profissional, (contagem.get(c.id_profissional) ?? 0) + 1)
    }
    return Array.from(contagem.entries())
      .map(([id, atendimentos]) => ({ nome: profissionaisNomes.get(id) ?? 'Profissional removida', atendimentos }))
      .sort((a, b) => b.atendimentos - a.atendimentos)
  }, [comandasFechadas, intervalo, profissionaisNomes])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Indicadores de <span className="font-medium text-foreground">{nomeNegocio}</span>
        </p>
        <FiltroPeriodo
          preset={preset}
          onPresetChange={setPreset}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicioChange={setDataInicio}
          onDataFimChange={setDataFim}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardIndicador
          rotulo="Agendamentos hoje"
          valor={totalAgendamentosHoje}
          carregando={carregando}
          detalhe={
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(breakdownStatus).map(([status, quantidade]) => (
                <Badge key={status} className="gap-1" style={{ backgroundColor: `${STATUS[status as keyof typeof STATUS]}22`, color: STATUS[status as keyof typeof STATUS] }}>
                  {ROTULOS_STATUS_AGENDAMENTO[status]}: {quantidade}
                </Badge>
              ))}
            </div>
          }
        />
        <CardIndicador
          rotulo="Contatos recebidos no WhatsApp"
          valor={contatosNoPeriodo.length}
          carregando={carregando}
          detalhe={<p className="text-xs text-muted-foreground">No período selecionado</p>}
        />
        <CardIndicador
          rotulo="Clientes novos"
          valor={clientesNovosNoPeriodo}
          carregando={carregando}
          detalhe={<p className="text-xs text-muted-foreground">Leads convertidos em cliente no período</p>}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CartaoGrafico
          titulo="Movimento do dia"
          descricao="Agendamentos e valor de comandas fechadas por horário, hoje"
          carregando={carregando}
          vazio={movimentoDia.every((p) => p.agendamentos === 0 && p.valorComandas === 0)}
          mensagemVazia="Nenhum agendamento ou comanda fechada hoje ainda."
        >
          <GraficoMovimentoDia dados={movimentoDia} />
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Atendimentos no WhatsApp por dia"
          descricao="Novos contatos recebidos ao longo do período"
          carregando={carregando}
          vazio={contatosNoPeriodo.length === 0}
        >
          <GraficoLinhaWhatsapp dados={contatosPorDia} />
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Dias com mais contatos"
          descricao="Volume histórico de novos contatos por dia da semana"
          carregando={carregando}
          vazio={contatos.length === 0}
        >
          <GraficoDiasSemana dados={diasComMaisContatos} />
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Atendimentos por profissional"
          descricao="Comandas fechadas no período, por profissional"
          carregando={carregando}
          vazio={atendimentosPorProfissional.length === 0}
        >
          <GraficoPorProfissional dados={atendimentosPorProfissional} />
        </CartaoGrafico>

        <CartaoGrafico
          titulo="Serviços mais vendidos"
          descricao="Serviços lançados em comandas no período"
          carregando={carregando}
          vazio={servicosVendidos.length === 0}
        >
          <GraficoServicosMaisVendidos dados={servicosVendidos} />
        </CartaoGrafico>
      </div>
    </div>
  )
}
