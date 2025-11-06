<template>
  <footer class="footer">
    <div class="footer__top container">
      <RouterLink to="/" class="footer__brand">
        <img :src="footerLogo" alt="АВТОСИЛИКОН" />
      </RouterLink>
      <div class="footer__columns">
        <section v-for="column in columns" :key="column.title" class="footer__column">
          <h3 class="footer__heading">{{ column.title }}</h3>
          <ul>
            <li v-for="link in column.links" :key="link.href">
              <RouterLink v-if="link.internal" :to="link.href">{{ link.label }}</RouterLink>
              <a v-else :href="link.href" target="_blank" rel="noopener">{{ link.label }}</a>
            </li>
          </ul>
        </section>
      </div>
    </div>
    <div class="footer__bottom">
      <div class="container footer__bottom-inner">
        <span>© 2011–{{ currentYear }} АВТОСИЛИКОН. Все права защищены.</span>
        <a href="https://cs20.ru/catalog.pdf" target="_blank" rel="noopener">PDF-каталог</a>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import footerLogo from '/placeholder/img-hed/Pokecut_1761944809641.png?url';

const columns = [
  {
    title: 'Компания АВТОСИЛИКОН',
    links: [
      { label: 'Новости', href: '/articles', internal: true },
      { label: 'Контакты', href: '/contacts', internal: true },
      { label: 'О компании', href: '/about', internal: true },
    ],
  },
  {
    title: 'Клиентам',
    links: [
      { label: 'Гарантия и возврат', href: '/info/warranty', internal: true },
      { label: 'Оплата', href: '/info/payment', internal: true },
      { label: 'Доставка', href: '/info/delivery', internal: true },
    ],
  },
  {
    title: 'Информация',
    links: [
      { label: 'Политика конфиденциальности', href: '/policy', internal: true },
      { label: 'Использование товарных знаков', href: '#', internal: false },
    ],
  },
  {
    title: 'Соцсети',
    links: [
      { label: 'ВКонтакте', href: 'https://vk.com/cs20', internal: false },
      { label: 'DRIVE2', href: 'https://www.drive2.ru/c/359008/', internal: false },
      { label: 'YouTube', href: 'https://www.youtube.com/', internal: false },
      { label: 'TikTok', href: 'https://www.tiktok.com/', internal: false },
    ],
  },
  {
    title: 'Где купить',
    links: [
      { label: 'OZON', href: 'https://www.ozon.ru/', internal: false },
      { label: 'Wildberries', href: 'https://www.wildberries.ru/', internal: false },
      { label: 'Exist', href: 'https://www.exist.ru/', internal: false },
      { label: 'Emex', href: 'https://www.emex.ru/', internal: false },
    ],
  },
];

const currentYear = computed(() => new Date().getFullYear());
</script>

<style scoped lang="scss">
.footer {
  background-color: var(--brand-primary);
  color: #fff;
  padding-top: var(--space-7);
}

.footer__brand {
  display: inline-flex;
  margin-bottom: var(--space-5);

  img {
    height: 64px;
  }
}

.footer__columns {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: var(--space-6);
}

.footer__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--fz-caption);
    line-height: var(--lh-caption);
  }
}

.footer__heading {
  font-size: var(--fz-body);
  line-height: var(--lh-body);
  font-weight: 600;
  text-transform: uppercase;
}

.footer__bottom {
  background: rgba(118, 194, 240, 0.2);
  padding: var(--space-3) 0;
  font-size: 14px;
}

.footer__bottom-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);

  a {
    color: var(--accent);
    font-weight: 600;
  }

  @media (max-width: $breakpoint-tablet) {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
