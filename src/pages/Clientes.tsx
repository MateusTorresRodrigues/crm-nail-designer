import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users as UsersIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarData } from '@/lib/date'
import { useCadastrosApoio } from '@/hooks/useCadastrosApoio'
import type { Contato } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ClienteDrawer from '@/components/clientes/ClienteDrawer'
import NovoClienteModal from '@/components/clientes/NovoClienteModal'

const TODOS = '__todos__'

interface ClienteComExtras extends Contato {
  profissionalNome: string | null
  ultimoAtendimento: string | null
}

export default function Clientes() {
  const { profissionais, servicos } = useCadastrosApoio()

  const [clientes, setClientes] = useState<ClienteComExtras[]>([])
  const [carregando, setCarregando] = useState(true)

  const [busca, setBusca] = useState('')
  const [filtroProfissional, setFiltroProfissional] = useState(TODOS)
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')

  const [clienteSelecionado, setClienteSelecionado] = useState<Contato | null>(null)
  const [drawerAberto, setDrawerAberto] = useState(false)
  const [novoClienteAberto, setNovoClienteAberto] = useState(false)

  async function carregarClientes() {
    setCarregando(true)

    const { data: contatos } = await supabase
      .from('crm_naildesigner')
      .select('*, profissionais(nome)')
      .eq('tipo', 'cliente')
      .order('created_at', { ascending: false })

    const idsClientes = (contatos ?? []).map((c) => c.id)

    const [respAgendamentos, respComandas] = idsClientes.length
      ? await Promise.all([
          supabase
            .from('agendamentos')
            .select('id_cliente, data_hora_inicio')
            .eq('status', 'concluido')
            .in('id_cliente', idsClientes),
          supabase
            .from('comandas')
            .select('id_cliente, created_at')
            .eq('status', 'fechada')
            .in('id_cliente', idsClientes),
        ])
      : [{ data: [] }, { data: [] }]

    const ultimoAtendimentoPorCliente = new Map<string, string>()

    for (const item of respAgendamentos.data ?? []) {
      const atual = ultimoAtendimentoPorCliente.get(item.id_cliente)
      if (!atual || new Date(item.data_hora_inicio) > new Date(atual)) {
        ultimoAtendimentoPorCliente.set(item.id_cliente, item.data_hora_inicio)
      }
    }

    for (const item of respComandas.data ?? []) {
      const atual = ultimoAtendimentoPorCliente.get(item.id_cliente)
      if (!atual || new Date(item.created_at) > new Date(atual)) {
        ultimoAtendimentoPorCliente.set(item.id_cliente, item.created_at)
      }
    }

    const listaCompleta: ClienteComExtras[] = (contatos ?? []).map((contato) => {
      const { profissionais: profissionalRelacionado, ...resto } = contato as Contato & {
        profissionais: { nome: string } | null
      }
      return {
        ...resto,
        profissionalNome: profissionalRelacionado?.nome ?? null,
        ultimoAtendimento: ultimoAtendimentoPorCliente.get(contato.id) ?? null,
      }
    })

    setClientes(listaCompleta)
    setCarregando(false)
  }

  useEffect(() => {
    carregarClientes()
  }, [])

  const clientesFiltrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase()

    return clientes.filter((cliente) => {
      if (buscaNormalizada) {
        const correspondeNome = cliente.nome?.toLowerCase().includes(buscaNormalizada)
        const correspondeWhatsapp = cliente.whatsapp.toLowerCase().includes(buscaNormalizada)
        if (!correspondeNome && !correspondeWhatsapp) return false
      }

      if (filtroProfissional !== TODOS && cliente.profissional_preferida !== filtroProfissional) {
        return false
      }

      if (dataDe && new Date(cliente.created_at) < new Date(dataDe)) return false
      if (dataAte && new Date(cliente.created_at) > new Date(`${dataAte}T23:59:59`)) return false

      return true
    })
  }, [clientes, busca, filtroProfissional, dataDe, dataAte])

  function abrirDrawer(cliente: Contato) {
    setClienteSelecionado(cliente)
    setDrawerAberto(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={() => setNovoClienteAberto(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome ou WhatsApp"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div className="min-w-[200px] space-y-1.5">
            <label className="text-sm font-medium text-foreground">Profissional preferida</label>
            <Select value={filtroProfissional} onValueChange={setFiltroProfissional}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cadastrado de</label>
            <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">até</label>
            <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando clientes...</p>
          )}

          {!carregando && clientesFiltrados.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <UsersIcon className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">
                {clientes.length === 0
                  ? 'Nenhum cliente cadastrado ainda'
                  : 'Nenhum cliente encontrado com esses filtros'}
              </p>
              <p className="text-sm text-muted-foreground">
                {clientes.length === 0
                  ? 'Cadastre manualmente com "Novo cliente" ou aguarde um lead comparecer a um atendimento.'
                  : 'Tente ajustar a busca ou os filtros aplicados.'}
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
                    <th className="px-5 py-3 font-medium">Profissional preferida</th>
                    <th className="px-5 py-3 font-medium">Cadastro</th>
                    <th className="px-5 py-3 font-medium">Último atendimento</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((cliente) => (
                    <tr
                      key={cliente.id}
                      onClick={() => abrirDrawer(cliente)}
                      className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/60"
                    >
                      <td className="px-5 py-3 font-medium text-foreground">
                        {cliente.nome || '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{cliente.whatsapp}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {cliente.profissionalNome ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatarData(cliente.created_at)}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {formatarData(cliente.ultimoAtendimento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClienteDrawer
        cliente={clienteSelecionado}
        aberto={drawerAberto}
        onOpenChange={setDrawerAberto}
        profissionais={profissionais}
        servicos={servicos}
        onAtualizado={carregarClientes}
        onExcluido={carregarClientes}
      />

      <NovoClienteModal
        aberto={novoClienteAberto}
        onOpenChange={setNovoClienteAberto}
        profissionais={profissionais}
        onCriado={carregarClientes}
      />
    </div>
  )
}
