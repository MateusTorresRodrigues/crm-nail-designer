import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OpcoesConfirmacao {
  titulo?: string
  descricao?: string
  textoConfirmar?: string
  textoCancelar?: string
}

interface ConfirmDialogContextValue {
  confirmarExclusao: (opcoes?: OpcoesConfirmacao) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | undefined>(undefined)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const [opcoes, setOpcoes] = useState<OpcoesConfirmacao>({})
  const [resolvePromise, setResolvePromise] = useState<((valor: boolean) => void) | null>(null)

  function confirmarExclusao(novasOpcoes?: OpcoesConfirmacao) {
    setOpcoes(novasOpcoes ?? {})
    setAberto(true)
    return new Promise<boolean>((resolve) => {
      setResolvePromise(() => resolve)
    })
  }

  function lidarComResposta(resposta: boolean) {
    setAberto(false)
    resolvePromise?.(resposta)
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirmarExclusao }}>
      {children}
      <Dialog open={aberto} onOpenChange={(valor) => !valor && lidarComResposta(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opcoes.titulo ?? 'Confirmar exclusão'}</DialogTitle>
            <DialogDescription>
              {opcoes.descricao ?? 'Essa ação não pode ser desfeita. Deseja realmente excluir este registro?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => lidarComResposta(false)}>
              {opcoes.textoCancelar ?? 'Cancelar'}
            </Button>
            <Button variant="destructive" onClick={() => lidarComResposta(true)}>
              {opcoes.textoConfirmar ?? 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext)
  if (!context) {
    throw new Error('useConfirmDialog deve ser usado dentro de um ConfirmDialogProvider')
  }
  return context
}
