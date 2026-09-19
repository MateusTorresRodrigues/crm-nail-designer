import { NavLink } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfiguracao } from '@/contexts/ConfiguracaoContext'
import { itensMenu } from './nav-items'

export default function Sidebar() {
  const { nomeNegocio, logoUrl } = useConfiguracao()

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        {logoUrl ? (
          <img src={logoUrl} alt={nomeNegocio} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
        )}
        <span className="font-serif text-lg font-semibold leading-tight">{nomeNegocio}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {itensMenu.map(({ rotulo, caminho, icone: Icone }) => (
          <NavLink
            key={caminho}
            to={caminho}
            end={caminho === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-soft'
                  : 'text-sidebar-foreground/80 hover:bg-primary/10 hover:text-sidebar-foreground',
              )
            }
          >
            <Icone className="h-5 w-5 shrink-0" />
            {rotulo}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
