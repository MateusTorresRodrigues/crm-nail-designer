import { useLocation } from 'react-router-dom'
import { LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { itensMenu } from './nav-items'

function obterTituloPagina(caminho: string) {
  const item = itensMenu.find((item) =>
    item.caminho === '/' ? caminho === '/' : caminho.startsWith(item.caminho),
  )
  return item?.rotulo ?? 'Sistema'
}

function iniciaisDoEmail(email?: string | null) {
  if (!email) return '?'
  return email.slice(0, 2).toUpperCase()
}

export default function Header() {
  const location = useLocation()
  const { user, sair } = useAuth()
  const titulo = obterTituloPagina(location.pathname)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="font-serif text-xl font-semibold text-foreground">{titulo}</h1>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 outline-none transition-colors hover:bg-muted">
          <Avatar>
            <AvatarFallback>{iniciaisDoEmail(user?.email)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {user?.email}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="gap-2 opacity-100">
            <UserIcon className="h-4 w-4" />
            {user?.email}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => sair()} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
