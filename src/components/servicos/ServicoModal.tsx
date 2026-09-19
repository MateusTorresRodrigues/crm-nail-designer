import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Servico } from '@/types/database'
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

interface ServicoModalProps {
  servico: Servico | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  onSalvo: () => void
  diasInatividadePadrao: number
}

export default function ServicoModal({
  servico,
  aberto,
  onOpenChange,
  onSalvo,
  diasInatividadePadrao,
}: ServicoModalProps) {
  const { user } = useAuth()
  const modoEdicao = servico !== null

  const [nome, setNome] = useState('')
  const [duracao, setDuracao] = useState('')
  const [valor, setValor] = useState('')
  const [diasRetorno, setDiasRetorno] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setNome(servico?.nome ?? '')
    setDuracao(servico?.duracao_minutos ? String(servico.duracao_minutos) : '')
    setValor(servico?.valor ? String(servico.valor) : '')
    setDiasRetorno(servico?.dias_retorno ? String(servico.dias_retorno) : '')
    setErro(null)
  }, [servico, aberto])

  async function salvar() {
    const duracaoNum = Number(duracao)
    const valorNum = Number(valor.replace(',', '.'))

    if (!nome.trim()) {
      setErro('Informe o nome do serviço.')
      return
    }
    if (!duracaoNum || duracaoNum <= 0) {
      setErro('Informe uma duração válida em minutos.')
      return
    }
    if (!valorNum || valorNum <= 0) {
      setErro('Informe um valor válido.')
      return
    }

    setSalvando(true)
    setErro(null)

    const dados = {
      nome: nome.trim(),
      duracao_minutos: duracaoNum,
      valor: valorNum,
      dias_retorno: diasRetorno ? Number(diasRetorno) : null,
    }

    if (modoEdicao && servico) {
      const { error } = await supabase.from('servicos').update(dados).eq('id', servico.id)
      setSalvando(false)

      if (error) {
        setErro('Não foi possível salvar: ' + error.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'atualizar_servico',
        tabela: 'servicos',
        idRegistro: servico.id,
        dadosAnteriores: servico,
        dadosNovos: dados,
      })
    } else {
      const { data, error } = await supabase.from('servicos').insert(dados).select().single()
      setSalvando(false)

      if (error || !data) {
        setErro('Não foi possível criar: ' + error?.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'criar_servico',
        tabela: 'servicos',
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
          <DialogTitle>{modoEdicao ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome-servico">Nome</Label>
            <Input id="nome-servico" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duracao-servico">Duração (minutos)</Label>
              <Input
                id="duracao-servico"
                type="number"
                min={1}
                value={duracao}
                onChange={(e) => setDuracao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor-servico">Valor (R$)</Label>
              <Input
                id="valor-servico"
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dias-retorno-servico">Dias para retorno (opcional)</Label>
            <Input
              id="dias-retorno-servico"
              type="number"
              min={1}
              placeholder={`Padrão da clínica: ${diasInatividadePadrao} dias`}
              value={diasRetorno}
              onChange={(e) => setDiasRetorno(e.target.value)}
            />
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
            {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Criar serviço'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
