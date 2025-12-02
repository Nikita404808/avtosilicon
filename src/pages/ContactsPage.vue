<template>
  <div class="contacts page-content">
    <section class="contacts__info page-content">
      <h1>Контакты</h1>
      <ul>
        <li>
          <strong>Адрес:</strong>
          413864, Саратовская область, г. Балаково, ул. Саратовское шоссе 52/3, цокольный этаж, ТД
          «Генезис»
        </li>
        <li><strong>Режим работы:</strong> Пн–Пт: 08:00–18:00</li>
        <li><strong>E-mail:</strong> <a href="mailto:autosilicone64@yandex.ru">autosilicone64@yandex.ru</a></li>
        <li><strong>Телефон:</strong> <a href="tel:+79061530222">+7 (906) 153-02-22</a> — Александр Владимирович</li>
        <li><strong>Соцсети:</strong> <a href="https://vk.com/autosilicone" target="_blank" rel="noopener">ВКонтакте</a></li>
      </ul>
    </section>
    <section class="contacts__map page-content">
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
</script>

<style scoped lang="scss">
.contacts {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.contacts__info {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 4px;
  margin-top: 0;
  padding-top: var(--space-7);
  padding-left: 0;

  h1 {
    margin: 0 0 var(--space-5);
    line-height: 1.1;
    padding-left: 0;
    margin-left: calc(-1 * var(--space-2));
  }

  ul {
    padding: 0;
    margin: calc(-1 * var(--space-1)) 0 0;
    display: grid;
    gap: var(--space-2);
    list-style: none;
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

@media (max-width: $breakpoint-mobile) {
  .contacts {
    padding-top: var(--space-4);
    gap: var(--space-4);
  }

  .contacts__info {
    background: var(--surface);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .contacts__info h1 {
    margin-left: 0;
    padding-left: 0;
  }

  .contacts__map {
    padding: var(--space-4);
  }

  .contacts__map-frame {
    height: 200px;
  }
}
</style>
