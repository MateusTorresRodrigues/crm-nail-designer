import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Produto } from '@/types/database'
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

interface ProdutoModalProps {
  produto: Produto | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  onSalvo: () => void
}

export default function ProdutoModal({ produto, aberto, onOpenChange, onSalvo }: ProdutoModalProps) {
  const { user } = useAuth()
  const modoEdicao = produto !== null

  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [estoque, setEstoque] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setNome(produto?.nome ?? '')
    setPreco(produto?.preco ? String(produto.preco) : '')
    setEstoque(produto ? String(produto.estoque) : '0')
    setErro(null)
  }, [produto, aberto])

  async function salvar() {
    const precoNum = Number(preco.replace(',', '.'))
    const estoqueNum = Number(estoque)

    if (!nome.trim()) {
      setErro('Informe o nome do produto.')
      return
    }
    if (!precoNum || precoNum <= 0) {
      setErro('Informe um preço válido.')
      return
    }
    if (!Number.isInteger(estoqueNum) || estoqueNum < 0) {
      setErro('Informe um estoque válido (número inteiro, 0 ou mais).')
      return
    }

    setSalvando(true)
    setErro(null)

    const dados = { nome: nome.trim(), preco: precoNum, estoque: estoqueNum }

    if (modoEdicao && produto) {
      const { error } = await supabase.from('produtos').update(dados).eq('id', produto.id)
      setSalvando(false)

      if (error) {
        setErro('Não foi possível salvar: ' + error.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'atualizar_produto',
        tabela: 'produtos',
        idRegistro: produto.id,
        dadosAnteriores: produto,
        dadosNovos: dados,
      })
    } else {
      const { data, error } = await supabase.from('produtos').insert(dados).select().single()
      setSalvando(false)

      if (error || !data) {
        setErro('Não foi possível criar: ' + error?.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'criar_produto',
        tabela: 'produtos',
        idRegistro: data.id,
        dadosNovos: dados,
      })
    }

    onSalvo()
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modoEdicao ? 'Editar produto' : 'Novo produto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome-produto">Nome</Label>
            <Input id="nome-produto" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="preco-produto">Preço (R$)</Label>
              <Input
                id="preco-produto"
                type="number"
                min={0}
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estoque-produto">
                {modoEdicao ? 'Estoque (ajuste manual)' : 'Estoque inicial'}
              </Label>
              <Input
                id="estoque-produto"
                type="number"
                min={0}
                step="1"
                value={estoque}
                onChange={(e) => setEstoque(e.target.value)}
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
            {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
