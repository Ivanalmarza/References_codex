export interface MenuLink {
  label: string
  to: string
}

export interface MenuGroup {
  label: string
  children: MenuLink[]
}

export type MenuEntry = MenuLink | MenuGroup

/** Mirrors the axetflows-app menu ("References Generator"). */
export const MENU: MenuEntry[] = [
  { label: 'Iniciar generador', to: '/start' },
  { label: 'Recuperar sesión', to: '/' },
  {
    label: 'Admin. Area',
    children: [
      { label: 'Admin files', to: '/admin/files' },
      { label: 'Log viewer', to: '/logs' },
      { label: 'Oportunidades MANA', to: '/admin/opportunities' },
      { label: 'User Okta search', to: '/admin/users' },
    ],
  },
]

export function isGroup(entry: MenuEntry): entry is MenuGroup {
  return (entry as MenuGroup).children !== undefined
}
