import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { registrarLog } from '@/lib/logs'
import { useAuth } from '@/contexts/AuthContext'
import type { Disponibilidade, Profissional } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import DisponibilidadeGrid from './DisponibilidadeGrid'

interface ProfissionalModalProps {
  profissional: Profissional | null
  aberto: boolean
  onOpenChange: (aberto: boolean) => void
  onSalvo: () => void
}

export default function ProfissionalModal({
  profissional,
  aberto,
  onOpenChange,
  onSalvo,
}: ProfissionalModalProps) {
  const { user } = useAuth()
  const modoEdicao = profissional !== null

  const [nome, setNome] = useState('')
  const [almocoInicio, setAlmocoInicio] = useState('')
  const [almocoFim, setAlmocoFim] = useState('')
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>({})
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setNome(profissional?.nome ?? '')
    setAlmocoInicio(profissional?.horario_almoco_inicio?.slice(0, 5) ?? '')
    setAlmocoFim(profissional?.horario_almoco_fim?.slice(0, 5) ?? '')
    setDisponibilidade(profissional?.disponibilidade ?? {})
    setErro(null)
  }, [profissional, aberto])

  async function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome da profissional.')
      return
    }

    setSalvando(true)
    setErro(null)

    const dados = {
      nome: nome.trim(),
      horario_almoco_inicio: almocoInicio || null,
      horario_almoco_fim: almocoFim || null,
      disponibilidade: modoEdicao ? disponibilidade : {},
    }

    if (modoEdicao && profissional) {
      const { error } = await supabase.from('profissionais').update(dados).eq('id', profissional.id)
      setSalvando(false)

      if (error) {
        setErro('Não foi possível salvar: ' + error.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'atualizar_profissional',
        tabela: 'profissionais',
        idRegistro: profissional.id,
        dadosAnteriores: profissional,
        dadosNovos: dados,
      })
    } else {
      const { data, error } = await supabase.from('profissionais').insert(dados).select().single()
      setSalvando(false)

      if (error || !data) {
        setErro('Não foi possível criar: ' + error?.message)
        return
      }

      await registrarLog({
        usuarioId: user?.id,
        acao: 'criar_profissional',
        tabela: 'profissionais',
        idRegistro: data.id,
        dadosNovos: dados,
      })
    }

    onSalvo()
    onOpenChange(false)
  }

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{modoEdicao ? 'Editar profissional' : 'Nova profissional'}</DialogTitle>
          {!modoEdicao && (
            <DialogDescription>
              Cadastre o nome agora e complete horário de almoço e disponibilidade depois, editando o
              registro.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome-profissional">Nome</Label>
            <Input id="nome-profissional" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          {modoEdicao && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="almoco-inicio">Almoço — início</Label>
                  <Input
                    id="almoco-inicio"
                    type="time"
                    value={almocoInicio}
                    onChange={(e) => setAlmocoInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="almoco-fim">Almoço — fim</Label>
                  <Input
                    id="almoco-fim"
                    type="time"
                    value={almocoFim}
                    onChange={(e) => setAlmocoFim(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Disponibilidade semanal</Label>
                <DisponibilidadeGrid value={disponibilidade} onChange={setDisponibilidade} />
              </div>
            </>
          )}

          {erro && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando...' : modoEdicao ? 'Salvar alterações' : 'Criar profissional'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
