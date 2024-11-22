import { createApp } from 'vue'

import './style.css'
import App from './App.vue'

import ToastService from 'primevue/toastservice';

import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import 'primeicons/primeicons.css'

createApp(App)
  .use(PrimeVue, {
    theme: {
      preset: Aura,
      options: {
        darkModeSelector: '.dark'
      }
    }
  })
  .use(ToastService)
  .mount('#app')
