import { Notyf } from 'notyf'

export const notyf = new Notyf({
  duration: 4200,
  position: { x: 'right', y: 'top' },
  dismissible: true,
  types: [{ type: 'warning', background: '#b45309', icon: false }],
})

export const notify = {
  success: (message: string) => notyf.success(message),
  error: (message: string) => notyf.error(message),
  warning: (message: string) => notyf.open({ type: 'warning', message }),
}
