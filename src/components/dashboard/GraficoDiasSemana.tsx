import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHROME, corCategorica } from '@/lib/paleta-graficos'
import TooltipGrafico from './TooltipGrafico'

export interface PontoDiaSemana {
  rotulo: string
  contatos: number
}

interface GraficoDiasSemanaProps {
  dados: PontoDiaSemana[]
}

export default function GraficoDiasSemana({ dados }: GraficoDiasSemanaProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} barCategoryGap={10}>
        <CartesianGrid vertical={false} stroke={CHROME.grid} />
        <XAxis
          dataKey="rotulo"
          tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
          axisLine={{ stroke: CHROME.eixo }}
          tickLine={false}
        />
        <YAxis allowDecimals={false} tick={{ fill: CHROME.textoMudo, fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <TooltipGrafico
                titulo={label}
                itens={[{ rotulo: 'Contatos (histórico)', valor: String(payload[0]?.value ?? 0), cor: corCategorica(2) }]}
              />
            )
          }}
        />
        <Bar dataKey="contatos" fill={corCategorica(2)} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
