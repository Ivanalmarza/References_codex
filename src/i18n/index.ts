import { createI18n as createClientI18n, type I18n } from 'vue-i18n'
import { useStorage } from '../composable/useStorage'
import en from './locales/en.json'

let i18nInstance: I18n | null = null

export function createI18n(): I18n {
  if (i18nInstance) {
    return i18nInstance
  }

  const defaultLocale = useStorage<string>('locale', 'en')
  i18nInstance = createClientI18n({
    legacy: false,
    globalInjection: true,
    locale: defaultLocale.value,
    fallbackLocale: 'en',
    messages: { en },
  })

  return i18nInstance
}

export function getI18n(): I18n {
  return i18nInstance || createI18n()
}
