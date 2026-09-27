import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router.js'

const app = createApp(App).use(router)
router.isReady().then(() => app.mount('#app'))
