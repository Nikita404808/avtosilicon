<template>
  <footer class="footer">
    <div class="footer__top container">
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
        <span>© 2018–{{ currentYear }} АВТОСИЛИКОН. Все права защищены.</span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

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
      { label: 'Оплата', href: '/info/payment', internal: true },
      { label: 'Доставка', href: '/info/delivery', internal: true },
      { label: 'Поддержка', href: '/contacts', internal: true },
    ],
  },
  {
    title: 'Информация',
    links: [
      { label: 'Политика конфиденциальности', href: '/policy', internal: true },
    ],
  },
  {
    title: 'Маркетплейсы',
    links: [
      { label: 'OZON', href: 'https://www.ozon.ru/seller/novodel-885208/?miniapp=seller_885208', internal: false },
      { label: 'Wildberries', href: 'https://www.wildberries.ru/seller/446137', internal: false },
      { label: 'Яндекс Маркет', href: 'https://market.yandex.ru/cc/7uTH64', internal: false },
      { label: 'Avito', href: 'https://www.avito.ru/user/17fc1256e10a89600c7ac7975827b15d/profile?src=sharing', internal: false },
    ],
  },
  {
    title: 'Отзывы',
    links: [
      { label: 'Оставить отзыв во ВКонтакте', href: 'https://vk.com/autosilicone', internal: false },
    ],
  },
];

const currentYear = computed(() => new Date().getFullYear());
</script>

<style scoped lang="scss">
.footer {
  background-color: var(--brand-primary);
  color: #fff;
  padding-top: var(--space-6);
  text-align: center;
}

.footer__columns {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: var(--space-6);
  justify-items: center;
  justify-content: center;
}

.footer__column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;

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
  justify-content: center;
  gap: var(--space-4);
  text-align: center;
  flex-wrap: wrap;

  a {
    color: var(--accent);
    font-weight: 600;
  }

  @media (max-width: $breakpoint-tablet) {
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: $breakpoint-mobile) {
    text-align: center;
  }
}

@media (max-width: 640px) {
  .footer__columns {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .footer__heading {
    margin: 0;
  }
}
</style>
