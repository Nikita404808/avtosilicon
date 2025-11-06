import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from '@/stores/auth';
import './styles/globals.scss';
const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
const authStore = useAuthStore();
authStore.initialize().catch((error) => {
    console.error('[Auth] initialization failed', error);
});
app.mount('#app');
