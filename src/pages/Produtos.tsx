import { useEffect, useState } from 'react'
import { Package, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { formatarValor } from '@/lib/date'
import { ESTOQUE_BAIXO_LIMITE } from '@/lib/constantes'
import { useAuth } from '@/contexts/AuthContext'
import { useConfirmDialog } from '@/contexts/ConfirmDialogContext'
import type { Produto } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ProdutoModal from '@/components/produtos/ProdutoModal'

export default function Produtos() {
  const { user } = useAuth()
  const { confirmarExclusao } = useConfirmDialog()

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [selecionado, setSelecionado] = useState<Produto | null>(null)

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('produtos').select('*').order('nome')
    setProdutos(data ?? [])
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  function abrirCriacao() {
    setSelecionado(null)
    setModalAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setSelecionado(produto)
    setModalAberto(true)
  }

  async function alternarAtivo(produto: Produto) {
    const novoValor = !produto.ativo
    setProdutos((atual) => atual.map((p) => (p.id === produto.id ? { ...p, ativo: novoValor } : p)))

    const { error } = await supabase.from('produtos').update({ ativo: novoValor }).eq('id', produto.id)

    if (error) {
      setProdutos((atual) => atual.map((p) => (p.id === produto.id ? { ...p, ativo: produto.ativo } : p)))
      alert('Não foi possível atualizar o status: ' + error.message)
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: novoValor ? 'ativar_produto' : 'desativar_produto',
      tabela: 'produtos',
      idRegistro: produto.id,
      dadosAnteriores: { ativo: produto.ativo },
      dadosNovos: { ativo: novoValor },
    })
  }

  async function excluir(produto: Produto) {
    const confirmado = await confirmarExclusao({
      titulo: 'Excluir produto',
      descricao: `Tem certeza que deseja excluir ${produto.nome}? Essa ação não pode ser desfeita.`,
    })
    if (!confirmado) return

    const { error } = await supabase.from('produtos').delete().eq('id', produto.id)

    if (error) {
      alert(
        'Não foi possível excluir: ' +
          (error.message.includes('foreign key')
            ? 'este produto está vinculado a itens de comanda existentes. Desative-o em vez de excluir.'
            : error.message),
      )
      return
    }

    await registrarLog({
      usuarioId: user?.id,
      acao: 'excluir_produto',
      tabela: 'produtos',
      idRegistro: produto.id,
      dadosAnteriores: produto,
    })

    carregar()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button onClick={abrirCriacao} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {carregando && (
            <p className="p-8 text-center text-sm text-muted-foreground">Carregando produtos...</p>
          )}

          {!carregando && produtos.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium text-foreground">Nenhum produto cadastrado ainda</p>
              <p className="text-sm text-muted-foreground">
                Cadastre os produtos vendidos ou utilizados nos atendimentos da clínica.
              </p>
            </div>
          )}

          {!carregando && produtos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">Preço</th>
                    <th className="px-5 py-3 font-medium">Estoque</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/60"
                    >
                      <td
                        className="cursor-pointer px-5 py-3 font-medium text-foreground"
                        onClick={() => abrirEdicao(produto)}
                      >
                        {produto.nome}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{formatarValor(produto.preco)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{produto.estoque} un.</span>
                          {produto.estoque < ESTOQUE_BAIXO_LIMITE && (
                            <Badge variant="destructive">Estoque baixo</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <button onClick={() => alternarAtivo(produto)}>
                          <Badge variant={produto.ativo ? 'accent' : 'outline'}>
                            {produto.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => abrirEdicao(produto)}>
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => excluir(produto)}>
                            Excluir
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProdutoModal
        produto={selecionado}
        aberto={modalAberto}
        onOpenChange={setModalAberto}
        onSalvo={carregar}
      />
    </div>
  )
}
