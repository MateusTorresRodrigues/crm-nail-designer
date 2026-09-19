import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatarDataHora } from '@/lib/date'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DadosLog from '@/components/logs/DadosLog'

interface LogRegistro {
  id: string
  id_usuario: string | null
  acao: string
  tabela: string | null
  id_registro: string | null
  dados_anteriores: Record<string, unknown> | null
  dados_novos: Record<string, unknown> | null
  created_at: string
  usuarioNome: string | null
}

const TODOS = '__todos__'
const ITENS_POR_PAGINA = 20

export default function Logs() {
  const [logs, setLogs] = useState<LogRegistro[]>([])
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([])
  const [tabelas, setTabelas] = useState<string[]>([])

  const [filtroUsuario, setFiltroUsuario] = useState(TODOS)
  const [filtroTabela, setFiltroTabela] = useState(TODOS)
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [pagina, setPagina] = useState(0)

  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  useEffect(() => {
    async function carregarFiltros() {
      const [respUsuarios, respTabelas] = await Promise.all([
        supabase.from('usuarios').select('id, nome').order('nome'),
        supabase.from('logs_sistema').select('tabela'),
      ])

      setUsuarios(respUsuarios.data ?? [])

      const tabelasUnicas = Array.from(
        new Set((respTabelas.data ?? []).map((l) => l.tabela).filter((t): t is string => Boolean(t))),
      ).sort()
      setTabelas(tabelasUnicas)
    }

    carregarFiltros()
  }, [])

  useEffect(() => {
    let ativo = true
    setCarregando(true)

    async function carregar() {
      let query = supabase
        .from('logs_sistema')
        .select('*, usuarios(nome)', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filtroUsuario !== TODOS) query = query.eq('id_usuario', filtroUsuario)
      if (filtroTabela !== TODOS) query = query.eq('tabela', filtroTabela)
      if (dataDe) query = query.gte('created_at', `${dataDe}T00:00:00`)
      if (dataAte) query = query.lte('created_at', `${dataAte}T23:59:59`)

      const inicio = pagina * ITENS_POR_PAGINA
      const fim = inicio + ITENS_POR_PAGINA - 1
      query = query.range(inicio, fim)

      const { data, count } = await query

      if (!ativo) return

      const mapeados: LogRegistro[] = (data ?? []).map((linha) => {
        const item = linha as unknown as LogRegistro & { usuarios: { nome: string } | null }
        return { ...item, usuarioNome: item.usuarios?.nome ?? null }
      })

      setLogs(mapeados)
      setTotalRegistros(count ?? 0)
      setCarregando(false)
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [filtroUsuario, filtroTabela, dataDe, dataAte, pagina])

  useEffect(() => {
    setPagina(0)
  }, [filtroUsuario, filtroTabela, dataDe, dataAte])

  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / ITENS_POR_PAGINA))

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] space-y-1.5">
            <label className="text-sm font-medium text-foreground">Usuário</label>
            <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px] space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tabela</label>
            <Select value={filtroTabela} onValueChange={setFiltroTabela}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {tabelas.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">De</label>
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
          {carregando && <p className="p-8 text-center text-sm text-muted-foreground">Carregando logs...</p>}

          {!carregando && logs.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Nenhum log encontrado</p>
              <p className="text-sm text-muted-foreground">Ajuste os filtros para ver outros registros.</p>
            </div>
          )}

          {!carregando && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="w-8 px-5 py-3" />
                    <th className="px-5 py-3 font-medium">Data/hora</th>
                    <th className="px-5 py-3 font-medium">Usuário</th>
                    <th className="px-5 py-3 font-medium">Ação</th>
                    <th className="px-5 py-3 font-medium">Tabela</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const expandido = expandidoId === log.id
                    return (
                      <Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandidoId(expandido ? null : log.id)}
                          className="cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/60"
                        >
                          <td className="px-5 py-3 text-muted-foreground">
                            {expandido ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {formatarDataHora(log.created_at)}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {log.usuarioNome ?? 'Sistema / agente de IA'}
                          </td>
                          <td className="px-5 py-3 font-medium text-foreground">{log.acao}</td>
                          <td className="px-5 py-3 text-muted-foreground">{log.tabela ?? '—'}</td>
                        </tr>
                        {expandido && (
                          <tr className="border-b border-border/60 bg-muted/40">
                            <td colSpan={5} className="px-5 py-4">
                              <div className="flex flex-wrap gap-6">
                                <DadosLog titulo="Dados anteriores" dados={log.dados_anteriores} />
                                <DadosLog titulo="Dados novos" dados={log.dados_novos} />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!carregando && totalRegistros > ITENS_POR_PAGINA && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-sm text-muted-foreground">
                Página {pagina + 1} de {totalPaginas} · {totalRegistros} registros
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => Math.max(0, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagina + 1 >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
