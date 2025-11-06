<template>
  <section class="life">
    <div class="container">
      <header class="life__header">
        <h2>Жизнь компании</h2>
        <p>Подписывайтесь на площадки, где мы делимся тестами, гонками и инициативами.</p>
      </header>
      <div class="life__grid">
        <article v-for="tile in tiles" :key="tile.id" class="life__tile">
          <img :src="tile.icon" :alt="tile.title" />
          <h3>{{ tile.title }}</h3>
          <p>{{ tile.description }}</p>
          <a :href="tile.href" target="_blank" rel="noopener" class="life__link">
            {{ tile.cta }}
          </a>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
type LifeTile = {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: string;
};

const tiles: LifeTile[] = [
  {
    id: 'racing',
    title: 'Racing Team',
    description: 'Следите за нашими выступлениями в кольцевых гонках и дрифте.',
    href: 'https://vk.com/cs20',
    cta: 'Смотреть календарь',
    icon: '/placeholder/life/racing.svg',
  },
  {
    id: 'youtube',
    title: 'YouTube',
    description: 'Обзоры продукции, интервью с инженерами и тестовые заезды.',
    href: 'https://youtube.com',
    cta: 'Подписаться',
    icon: '/placeholder/life/youtube.svg',
  },
  {
    id: 'drive2',
    title: 'Drive2',
    description: 'Истории клиентов и проекты на базе продукции АВТОСИЛИКОН.',
    href: 'https://drive2.ru',
    cta: 'Читать блог',
    icon: '/placeholder/life/drive2.svg',
  },
  {
    id: 'vk',
    title: 'ВКонтакте',
    description: 'Анонсы новинок, акции и обратная связь с техподдержкой.',
    href: 'https://vk.com/cs20',
    cta: 'Присоединиться',
    icon: '/placeholder/life/vk.svg',
  },
];
</script>

<style scoped lang="scss">
.life {
  padding: var(--space-8) 0;
}

.life__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  max-width: 600px;
}

.life__grid {
  display: grid;
  gap: var(--space-5);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.life__tile {
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  text-align: center;

  img {
    width: 68px;
    height: 68px;
    margin: 0 auto;
  }
}

.life__link {
  margin-top: auto;
  color: var(--accent);
  font-weight: 600;
}
</style>
