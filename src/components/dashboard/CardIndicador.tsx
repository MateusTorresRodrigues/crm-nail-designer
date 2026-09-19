import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface CardIndicadorProps {
  rotulo: string
  valor: ReactNode
  detalhe?: ReactNode
  carregando?: boolean
}

export default function CardIndicador({ rotulo, valor, detalhe, carregando }: CardIndicadorProps) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <p className="text-sm text-muted-foreground">{rotulo}</p>
        {carregando ? (
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        ) : (
          <p className="text-3xl font-semibold text-foreground">{valor}</p>
        )}
        {detalhe && !carregando && <div className="pt-1">{detalhe}</div>}
      </CardContent>
    </Card>
  )
}
