import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { createI18n } from './i18n'
import { useThemeStore } from './stores/theme'
import './assets/main.css'
import 'notyf/notyf.min.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia).use(router).use(createI18n())
useThemeStore(pinia).initializeTheme()
app.mount('#app')
