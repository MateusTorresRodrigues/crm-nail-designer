import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { formatarDataHora, formatarValor } from '@/lib/date'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Comanda, ItemComanda, Produto, Servico } from '@/types/database'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ComandaComNomes extends Comanda {
  clienteNome: string
  profissionalNome: string
}

interface ItemComNome extends ItemComanda {
  nomeItem: string
}

interface ComandaDrawerProps {
  comandaId: string | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  servicos: Servico[]
  produtos: Produto[]
  onAlterada: () => void
}

const TIPO_SERVICO = 'servico'
const TIPO_PRODUTO = 'produto'

export default function ComandaDrawer({
  comandaId,
  aberto,
  onOpenChange,
  servicos,
  produtos,
  onAlterada,
}: ComandaDrawerProps) {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [comanda, setComanda] = useState<ComandaComNomes | null>(null)
  const [itens, setItens] = useState<ItemComNome[]>([])
  const [carregando, setCarregando] = useState(true)

  const [tipoItem, setTipoItem] = useState<typeof TIPO_SERVICO | typeof TIPO_PRODUTO>(TIPO_SERVICO)
  const [itemSelecionadoId, setItemSelecionadoId] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorUnitario, setValorUnitario] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [erroItem, setErroItem] = useState<string | null>(null)
  const [fechando, setFechando] = useState(false)

  async function carregarComanda() {
    if (!comandaId) return
    setCarregando(true)

    const [respComanda, respItens] = await Promise.all([
      supabase
        .from('comandas')
        .select('*, crm_naildesigner!comandas_id_cliente_fkey(nome, whatsapp), profissionais(nome)')
        .eq('id', comandaId)
        .single(),
      supabase
        .from('itens_comanda')
        .select('*, servicos(nome), produtos(nome)')
        .eq('id_comanda', comandaId)
        .order('created_at'),
    ])

    if (respComanda.data) {
      const linha = respComanda.data as unknown as Comanda & {
        crm_naildesigner: { nome: string | null; whatsapp: string } | null
        profissionais: { nome: string } | null
      }
      setComanda({
        ...linha,
        clienteNome: linha.crm_naildesigner?.nome || linha.crm_naildesigner?.whatsapp || 'Cliente',
        profissionalNome: linha.profissionais?.nome ?? '—',
      })
    }

    const itensMapeados: ItemComNome[] = (respItens.data ?? []).map((linha) => {
      const item = linha as unknown as ItemComanda & {
        servicos: { nome: string } | null
        produtos: { nome: string } | null
      }
      return {
        ...item,
        nomeItem: item.servicos?.nome ?? item.produtos?.nome ?? 'Item',
      }
    })
    setItens(itensMapeados)
    setCarregando(false)
  }

  useEffect(() => {
    if (!aberto || !comandaId) return
    carregarComanda()
    setTipoItem(TIPO_SERVICO)
    setItemSelecionadoId('')
    setQuantidade('1')
    setValorUnitario('')
    setErroItem(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, comandaId])

  useEffect(() => {
    if (!itemSelecionadoId) {
      setValorUnitario('')
      return
    }
    if (tipoItem === TIPO_SERVICO) {
      const servico = servicos.find((s) => s.id === itemSelecionadoId)
      setValorUnitario(servico ? String(servico.valor) : '')
    } else {
      const produto = produtos.find((p) => p.id === itemSelecionadoId)
      setValorUnitario(produto ? String(produto.preco) : '')
    }
  }, [itemSelecionadoId, tipoItem, servicos, produtos])

  if (!comanda) return null

  const comandaAberta = comanda.status === 'aberta'

  async function adicionarItem() {
    if (!comandaId) return

    const quantidadeNum = Number(quantidade)
    const valorUnitarioNum = Number(valorUnitario.replace(',', '.'))

    if (!itemSelecionadoId) {
      setErroItem(`Selecione um ${tipoItem === TIPO_SERVICO ? 'serviço' : 'produto'}.`)
      return
    }
    if (!Number.isInteger(quantidadeNum) || quantidadeNum <= 0) {
      setErroItem('Informe uma quantidade válida.')
      return
    }
    if (!valorUnitarioNum || valorUnitarioNum <= 0) {
      setErroItem('Informe um valor unitário válido.')
      return
    }

    let produtoAtual: Produto | null = null
    if (tipoItem === TIPO_PRODUTO) {
      produtoAtual = produtos.find((p) => p.id === itemSelecionadoId) ?? null
      if (!produtoAtual) {
        setErroItem('Produto inválido.')
        return
      }
      if (produtoAtual.estoque < quantidadeNum) {
        setErroItem(`Estoque insuficiente. Disponível: ${produtoAtual.estoque} unidade(s).`)
        return
      }
    }

    setAdicionando(true)
    setErroItem(null)

    const dadosNovos = {
      id_comanda: comandaId,
      id_servico: tipoItem === TIPO_SERVICO ? itemSelecionadoId : null,
      id_produto: tipoItem === TIPO_PRODUTO ? itemSelecionadoId : null,
      quantidade: quantidadeNum,
      valor_unitario: valorUnitarioNum,
      valor_total: quantidadeNum * valorUnitarioNum,
    }

    const { data: itemCriado, error } = await supabase
      .from('itens_comanda')
      .insert(dadosNovos)
      .select()
      .single()

    if (error || !itemCriado) {
      setAdicionando(false)
      setErroItem('Não foi possível adicionar o item: ' + error?.message)
      return
    }

    if (produtoAtual) {
      await supabase
        .from('produtos')
        .update({ estoque: produtoAtual.estoque - quantidadeNum })
        .eq('id', produtoAtual.id)
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'adicionar_item_comanda',
      tabela: 'itens_comanda',
      idRegistro: itemCriado.id,
      dadosNovos,
    })

    setItemSelecionadoId('')
    setQuantidade('1')
    setValorUnitario('')
    setAdicionando(false)
    await carregarComanda()
    onAlterada()
  }

  async function removerItem(item: ItemComNome) {
    const confirmado = await confirmarExclusao({
      titulo: 'Remover item',
      descricao: `Remover "${item.nomeItem}" desta comanda?${
        item.id_produto ? ' O estoque do produto será devolvido.' : ''
      }`,
    })
    if (!confirmado) return

    const { error } = await supabase.from('itens_comanda').delete().eq('id', item.id)

    if (error) {
      alert('Não foi possível remover o item: ' + error.message)
      return
    }

    if (item.id_produto) {
      const produtoAtual = produtos.find((p) => p.id === item.id_produto)
      if (produtoAtual) {
        await supabase
          .from('produtos')
          .update({ estoque: produtoAtual.estoque + item.quantidade })
          .eq('id', produtoAtual.id)
      }
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'remover_item_comanda',
      tabela: 'itens_comanda',
      idRegistro: item.id,
      dadosAnteriores: item,
    })

    await carregarComanda()
    onAlterada()
  }

  async function fecharComanda() {
    if (!comandaId || !comanda) return
    if (itens.length === 0) return

    const confirmado = await confirmarExclusao({
      titulo: 'Fechar comanda',
      descricao: `Fechar a comanda de ${comanda.clienteNome}? Não será possível lançar novos itens depois.`,
      textoConfirmar: 'Fechar comanda',
      textoCancelar: 'Voltar',
    })
    if (!confirmado) return

    setFechando(true)

    const { error } = await supabase.from('comandas').update({ status: 'fechada' }).eq('id', comandaId)

    setFechando(false)

    if (error) {
      alert('Não foi possível fechar a comanda: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'fechar_comanda',
      tabela: 'comandas',
      idRegistro: comandaId,
      dadosAnteriores: { status: 'aberta' },
      dadosNovos: { status: 'fechada' },
    })

    await carregarComanda()
    onAlterada()
  }

  return (
    <Sheet open={aberto} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{comanda.clienteNome}</SheetTitle>
          <SheetDescription>
            {comanda.profissionalNome} · Aberta em {formatarDataHora(comanda.created_at)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
            <Badge variant={comandaAberta ? 'default' : 'outline'}>
              {comandaAberta ? 'Aberta' : 'Fechada'}
            </Badge>
            <span className="font-serif text-xl font-semibold text-foreground">
              {formatarValor(comanda.valor_total)}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="font-serif text-lg font-semibold text-foreground">Itens lançados</h3>

            {carregando && <p className="text-sm text-muted-foreground">Carregando itens...</p>}

            {!carregando && itens.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item lançado ainda.</p>
            )}

            {!carregando && itens.length > 0 && (
              <ul className="space-y-2">
                {itens.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{item.nomeItem}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantidade} × {formatarValor(item.valor_unitario)} ={' '}
                        {formatarValor(item.valor_total)}
                      </p>
                    </div>
                    {comandaAberta && (
                      <Button variant="ghost" size="icon" onClick={() => removerItem(item)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {comandaAberta && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3.5">
              <h4 className="text-sm font-semibold text-foreground">Lançar item</h4>

              <div className="flex gap-2 rounded-xl bg-background p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTipoItem(TIPO_SERVICO)
                    setItemSelecionadoId('')
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                    tipoItem === TIPO_SERVICO ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Serviço
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoItem(TIPO_PRODUTO)
                    setItemSelecionadoId('')
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                    tipoItem === TIPO_PRODUTO ? 'bg-card shadow-card text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Produto
                </button>
              </div>

              <div className="space-y-2">
                <Label>{tipoItem === TIPO_SERVICO ? 'Serviço' : 'Produto'}</Label>
                <Select value={itemSelecionadoId} onValueChange={setItemSelecionadoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipoItem === TIPO_SERVICO ? servicos : produtos).map((opcao) => (
                      <SelectItem key={opcao.id} value={opcao.id}>
                        {opcao.nome}
                        {tipoItem === TIPO_PRODUTO ? ` (estoque: ${(opcao as Produto).estoque})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="quantidade-item">Quantidade</Label>
                  <Input
                    id="quantidade-item"
                    type="number"
                    min={1}
                    step="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valor-unitario-item">Valor unitário</Label>
                  <Input
                    id="valor-unitario-item"
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorUnitario}
                    onChange={(e) => setValorUnitario(e.target.value)}
                  />
                </div>
              </div>

              {erroItem && <p className="text-sm text-destructive">{erroItem}</p>}

              <Button onClick={adicionarItem} disabled={adicionando} className="w-full">
                {adicionando ? 'Adicionando...' : 'Adicionar item'}
              </Button>
            </div>
          )}

          {comandaAberta && (
            <Button
              onClick={fecharComanda}
              disabled={fechando || itens.length === 0}
              variant="outline"
              className="w-full"
            >
              {fechando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : itens.length === 0 ? (
                'Lance ao menos um item para fechar'
              ) : (
                'Fechar comanda'
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
