<template>
  <div class="contacts container">
    <section class="contacts__info">
      <h1>Контакты</h1>
      <ul>
        <li><strong>Адрес:</strong> Саратовское ш., 52/3, Балаково</li>
        <li><strong>Режим работы:</strong> Пн–Сб 08:00–20:00</li>
        <li>
          <strong>Телефоны:</strong>
          <div class="contacts__phones">
            <a href="tel:+79061530222">+7 (906) 153-02-22</a>
            <a href="tel:+79272792360">+7 (927) 279-23-60</a>
          </div>
        </li>
      </ul>
      <div class="contacts__marketplaces">
        <h2>Где купить</h2>
        <div class="contacts__grid">
          <a v-for="market in marketplaces" :key="market.id" :href="market.href" target="_blank" rel="noopener">
            <img :src="market.icon" :alt="market.title" />
            <span>{{ market.title }}</span>
          </a>
        </div>
      </div>
    </section>
    <section class="contacts__map">
      <h2>Офис АВТОСИЛИКОН</h2>
      <div class="contacts__map-frame">
        <iframe
          src="https://yandex.ru/map-widget/v1/?z=17&ol=biz&oid=236035827759"
          title="Карта: Саратовское ш., 52/3, Балаково"
          frameborder="0"
          allowfullscreen
        ></iframe>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const marketplaces = [
  { id: 'ozon', title: 'OZON', href: 'https://www.ozon.ru', icon: '/placeholder/mp/ozon.svg' },
  {
    id: 'wildberries',
    title: 'Wildberries',
    href: 'https://www.wildberries.ru',
    icon: '/placeholder/mp/wildberries.svg',
  },
  { id: 'exist', title: 'Exist', href: 'https://www.exist.ru', icon: '/placeholder/mp/exist.svg' },
  { id: 'emex', title: 'EMEX', href: 'https://www.emex.ru', icon: '/placeholder/mp/emex.svg' },
];
</script>

<style scoped lang="scss">
.contacts {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.contacts__info {
  display: grid;
  gap: var(--space-4);

  ul {
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
    list-style: none;

    .contacts__phones {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }
  }
}

.contacts__marketplaces {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: var(--space-3);
}

.contacts__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);

  a {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border-radius: var(--radius-sm);
    padding: var(--space-2);
    background: rgba(0, 0, 0, 0.04);

    img {
      width: 32px;
      height: 32px;
    }
  }
}

.contacts__map {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: var(--space-3);
}

.contacts__map-frame {
  height: 240px;
  border-radius: var(--radius-md);
  overflow: hidden;

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
}
</style>
