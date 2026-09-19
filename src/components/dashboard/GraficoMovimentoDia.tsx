import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHROME, corCategorica } from '@/lib/paleta-graficos'
import { formatarValor } from '@/lib/date'
import TooltipGrafico from './TooltipGrafico'

export interface PontoMovimentoHora {
  hora: string
  agendamentos: number
  valorComandas: number
}

interface GraficoMovimentoDiaProps {
  dados: PontoMovimentoHora[]
}

export default function GraficoMovimentoDia({ dados }: GraficoMovimentoDiaProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Agendamentos por horário</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dados} barCategoryGap={6}>
            <CartesianGrid vertical={false} stroke={CHROME.grid} />
            <XAxis
              dataKey="hora"
              tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
              axisLine={{ stroke: CHROME.eixo }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <TooltipGrafico
                    titulo={`${label}h`}
                    itens={[
                      { rotulo: 'Agendamentos', valor: String(payload[0]?.value ?? 0), cor: corCategorica(0) },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="agendamentos" fill={corCategorica(0)} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Valor de comandas fechadas por horário</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dados} barCategoryGap={6}>
            <CartesianGrid vertical={false} stroke={CHROME.grid} />
            <XAxis
              dataKey="hora"
              tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
              axisLine={{ stroke: CHROME.eixo }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: CHROME.textoMudo, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v) => `R$${v}`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <TooltipGrafico
                    titulo={`${label}h`}
                    itens={[
                      {
                        rotulo: 'Comandas fechadas',
                        valor: formatarValor(Number(payload[0]?.value ?? 0)),
                        cor: corCategorica(1),
                      },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="valorComandas" fill={corCategorica(1)} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
