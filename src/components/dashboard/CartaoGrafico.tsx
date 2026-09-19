import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CartaoGraficoProps {
  titulo: string
  descricao?: string
  carregando?: boolean
  vazio?: boolean
  mensagemVazia?: string
  children: ReactNode
}

export default function CartaoGrafico({
  titulo,
  descricao,
  carregando,
  vazio,
  mensagemVazia = 'Sem dados suficientes no período selecionado.',
  children,
}: CartaoGraficoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        {carregando ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : vazio ? (
          <div className="flex h-64 items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">{mensagemVazia}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
