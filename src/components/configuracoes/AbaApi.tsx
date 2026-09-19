import { useEffect, useState } from 'react'
import { KeyRound, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { ENDPOINTS } from '@/lib/api-docs'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { ApiToken } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import NovoTokenModal from './NovoTokenModal'
import BlocoCurl from './BlocoCurl'

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`

function montarCurl(endpoint: (typeof ENDPOINTS)[number], token: string) {
  const tokenExibido = token || 'SEU_TOKEN_AQUI'
  let url = `${BASE_URL}${endpoint.caminho}`

  if (endpoint.metodo === 'GET' && endpoint.parametrosQuery) {
    const exemploQuery = endpoint.parametrosQuery
      .filter((p) => p.obrigatorio)
      .map((p) => `${p.nome}=${p.nome === 'data' ? '2026-09-20' : 'VALOR'}`)
      .join('&')
    url += exemploQuery ? `?${exemploQuery}` : ''
  }

  const linhas = [`curl -X ${endpoint.metodo} \\`, `  -H "Authorization: Bearer ${tokenExibido}" \\`]

  if (endpoint.corpoExemplo) {
    linhas.push(`  -H "Content-Type: application/json" \\`)
    linhas.push(`  -d '${JSON.stringify(endpoint.corpoExemplo)}' \\`)
  }

  linhas.push(`  "${url}"`)

  return linhas.join('\n')
}

export default function AbaApi() {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [carregando, setCarregando] = useState(true)
  const [tokenSelecionadoId, setTokenSelecionadoId] = useState<string>('')
  const [modalAberto, setModalAberto] = useState(false)

  async function carregarTokens() {
    setCarregando(true)
    const { data } = await supabase.from('api_tokens').select('*').order('created_at', { ascending: false })
    setTokens(data ?? [])
    setCarregando(false)
    if (data && data.length > 0 && !tokenSelecionadoId) {
      setTokenSelecionadoId(data[0].id)
    }
  }

  useEffect(() => {
    carregarTokens()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tokenSelecionado = tokens.find((t) => t.id === tokenSelecionadoId)

  async function alternarAtivo(tokenItem: ApiToken) {
    const novoValor = !tokenItem.ativo
    setTokens((atual) => atual.map((t) => (t.id === tokenItem.id ? { ...t, ativo: novoValor } : t)))

    const { error } = await supabase.from('api_tokens').update({ ativo: novoValor }).eq('id', tokenItem.id)

    if (error) {
      setTokens((atual) => atual.map((t) => (t.id === tokenItem.id ? { ...t, ativo: tokenItem.ativo } : t)))
      alert('Não foi possível atualizar o token: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: novoValor ? 'ativar_api_token' : 'desativar_api_token',
      tabela: 'api_tokens',
      idRegistro: tokenItem.id,
      dadosAnteriores: { ativo: tokenItem.ativo },
      dadosNovos: { ativo: novoValor },
    })
  }

  async function excluirToken(tokenItem: ApiToken) {
    const confirmado = await confirmarExclusao({
      titulo: 'Excluir token',
      descricao: `Excluir o token "${tokenItem.nome}"? Qualquer integração usando esse token deixará de funcionar imediatamente.`,
    })
    if (!confirmado) return

    const { error } = await supabase.from('api_tokens').delete().eq('id', tokenItem.id)

    if (error) {
      alert('Não foi possível excluir o token: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_api_token',
      tabela: 'api_tokens',
      idRegistro: tokenItem.id,
      dadosAnteriores: tokenItem,
    })

    if (tokenSelecionadoId === tokenItem.id) setTokenSelecionadoId('')
    carregarTokens()
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Tokens de acesso</CardTitle>
            <CardDescription>
              Usados pelo agente de IA no WhatsApp (via Evolution API/n8n) para autenticar as chamadas à API.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4" />
            Novo token
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {carregando && <p className="text-sm text-muted-foreground">Carregando tokens...</p>}

          {!carregando && tokens.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <KeyRound className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum token criado ainda. Crie um para liberar o acesso da automação.
              </p>
            </div>
          )}

          {!carregando &&
            tokens.map((tokenItem) => (
              <div
                key={tokenItem.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{tokenItem.nome}</p>
                  <code className="text-xs text-muted-foreground">{tokenItem.token}</code>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => alternarAtivo(tokenItem)}>
                    <Badge variant={tokenItem.ativo ? 'accent' : 'outline'}>
                      {tokenItem.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </button>
                  <Button variant="destructive" size="sm" onClick={() => excluirToken(tokenItem)}>
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentação dos endpoints</CardTitle>
          <CardDescription>
            Selecione um token para preenchê-lo automaticamente nos exemplos de cURL abaixo, prontos para colar no
            n8n.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-w-sm space-y-2">
            <Select value={tokenSelecionadoId} onValueChange={setTokenSelecionadoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um token" />
              </SelectTrigger>
              <SelectContent>
                {tokens.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome} {!t.ativo && '(inativo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Autenticação</p>
            <p className="text-muted-foreground">
              Toda requisição deve enviar o cabeçalho{' '}
              <code className="rounded bg-background px-1.5 py-0.5">Authorization: Bearer SEU_TOKEN_AQUI</code>.
              Sem um token válido e ativo, a API responde <code className="rounded bg-background px-1.5 py-0.5">401</code>{' '}
              com <code className="rounded bg-background px-1.5 py-0.5">{'{ "sucesso": false, "mensagem": "Token inválido ou inativo." }'}</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {ENDPOINTS.map((endpoint) => (
          <Card key={endpoint.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={endpoint.metodo === 'GET' ? 'accent' : 'default'}>{endpoint.metodo}</Badge>
                <code className="text-sm text-foreground">{endpoint.caminho}</code>
              </div>
              <CardTitle className="text-base">{endpoint.titulo}</CardTitle>
              <CardDescription>{endpoint.descricao}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {endpoint.parametrosQuery && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Parâmetros
                  </p>
                  <ul className="space-y-0.5 text-sm">
                    {endpoint.parametrosQuery.map((p) => (
                      <li key={p.nome}>
                        <code className="rounded bg-muted px-1.5 py-0.5">{p.nome}</code>{' '}
                        {p.obrigatorio ? (
                          <span className="text-destructive">obrigatório</span>
                        ) : (
                          <span className="text-muted-foreground">opcional</span>
                        )}{' '}
                        — {p.descricao}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {endpoint.corpoExemplo && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Corpo (JSON)
                  </p>
                  <pre className="overflow-x-auto rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground">
                    {JSON.stringify(endpoint.corpoExemplo, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resposta</p>
                <pre className="overflow-x-auto rounded-xl bg-muted/60 px-3 py-2 text-xs text-foreground">
                  {JSON.stringify(endpoint.respostaExemplo, null, 2)}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  cURL pronto para o n8n
                </p>
                <BlocoCurl comando={montarCurl(endpoint, tokenSelecionado?.token ?? '')} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NovoTokenModal
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        onCriado={(novoToken) => {
          setTokens((atual) => [novoToken, ...atual])
          setTokenSelecionadoId(novoToken.id)
        }}
      />
    </div>
  )
}
