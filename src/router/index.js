import { createRouter, createWebHistory } from 'vue-router';
const routes = [
    {
        path: '/',
        name: 'home',
        component: () => import('@/pages/HomePage.vue'),
        meta: { title: 'АВТОСИЛИКОН — Главная' },
    },
    {
        path: '/catalog',
        name: 'catalog',
        component: () => import('@/pages/CatalogPage.vue'),
        meta: { title: 'Каталог продукции — АВТОСИЛИКОН' },
    },
    {
        path: '/catalog/:slug',
        name: 'product',
        component: () => import('@/pages/ProductPage.vue'),
        meta: { title: 'Карточка товара — АВТОСИЛИКОН' },
    },
    {
        path: '/articles',
        name: 'articles',
        component: () => import('@/pages/ArticlesPage.vue'),
        meta: { title: 'Новости и обзоры — АВТОСИЛИКОН' },
    },
    {
        path: '/articles/:slug',
        name: 'article-details',
        component: () => import('@/pages/ArticleDetailsPage.vue'),
        meta: { title: 'Новость — АВТОСИЛИКОН' },
    },
    {
        path: '/about',
        name: 'about',
        component: () => import('@/pages/AboutPage.vue'),
        meta: { title: 'О компании — АВТОСИЛИКОН' },
    },
    {
        path: '/contacts',
        name: 'contacts',
        component: () => import('@/pages/ContactsPage.vue'),
        meta: { title: 'Контакты — АВТОСИЛИКОН' },
    },
    {
        path: '/account',
        name: 'account',
        component: () => import('@/pages/UserAccountPage.vue'),
        meta: { title: 'Личный кабинет — АВТОСИЛИКОН' },
    },
    {
        path: '/auth',
        name: 'register_or_login',
        component: () => import('@/pages/AuthRedirectPage.vue'),
        meta: { title: 'Вход или регистрация — АВТОСИЛИКОН' },
    },
    {
        path: '/cart/checkout',
        name: 'cart-checkout',
        component: () => import('@/pages/CartCheckoutPage.vue'),
        meta: { title: 'Оформление заказа — АВТОСИЛИКОН' },
    },
    {
        path: '/reset-password',
        name: 'reset-password',
        component: () => import('@/pages/ResetPasswordPage.vue'),
        meta: { title: 'Восстановление пароля — АВТОСИЛИКОН' },
    },
    {
        path: '/info/delivery',
        name: 'info-delivery',
        component: () => import('@/pages/InfoDelivery.vue'),
        meta: { title: 'Доставка — АВТОСИЛИКОН' },
    },
    {
        path: '/info/payment',
        name: 'info-payment',
        component: () => import('@/pages/InfoPayment.vue'),
        meta: { title: 'Оплата — АВТОСИЛИКОН' },
    },
    {
        path: '/policy',
        name: 'policy',
        component: () => import('@/pages/Policy.vue'),
        meta: { title: 'Политика конфиденциальности — АВТОСИЛИКОН' },
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'Страница не найдена — АВТОСИЛИКОН' },
    },
];
const router = createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior() {
        return { top: 0 };
    },
});
router.afterEach((to) => {
    if (typeof to.meta.title === 'string') {
        document.title = to.meta.title;
    }
});
export default router;
