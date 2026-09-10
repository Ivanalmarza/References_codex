import { Notyf } from 'notyf'

export const notyf = new Notyf({
  duration: 3500,
  position: { x: 'right', y: 'top' },
  dismissible: true,
  types: [{ type: 'warning', background: '#f59e0b', icon: false }],
})

export const notify = {
  success: (message: string) => notyf.success(message),
  error: (message: string) => notyf.error(message),
  warning: (message: string) => notyf.open({ type: 'warning', message }),
}
