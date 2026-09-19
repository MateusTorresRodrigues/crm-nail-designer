import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PaginaEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>Esta página será implementada em uma próxima etapa.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Em breve você poderá gerenciar {titulo.toLowerCase()} por aqui.
      </CardContent>
    </Card>
  )
}
