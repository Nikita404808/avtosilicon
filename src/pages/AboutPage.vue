<template>
  <div class="about page-content">
    <section class="about__hero page-content">
      <div class="about__hero-text">
        <p class="about__eyebrow">О нашей компании</p>
        <h1>АВТОСИЛИКОН</h1>
        <p>
          «АВТОСИЛИКОН» — динамично развивающаяся производственная компания, специализирующаяся на
          разработке и изготовлении высококачественных силиконовых патрубков и армированных шлангов
          для автомобильной, промышленной и тюнинг-индустрии.
        </p>
      </div>
      <figure class="about__hero-media">
        <img :src="aboutHeroImage" alt="Производственные патрубки АВТОСИЛИКОН" />
      </figure>
    </section>

    <section class="about__kpis">
      <article v-for="item in kpis" :key="item.label" class="about__kpi">
        <span class="about__kpi-value">{{ item.value }}</span>
        <span class="about__kpi-label">{{ item.label }}</span>
      </article>
    </section>

    <section class="about__block">
      <h2>Ключевые факты</h2>
      <ul>
        <li v-for="fact in keyFacts" :key="fact">{{ fact }}</li>
      </ul>
    </section>

    <section class="about__block">
      <h2>Наше производство и продукция</h2>
      <p>
        Компания основана в 2018 году командой инженеров и энтузиастов, решивших вывести на рынок
        продукцию, которая по качеству не уступает мировым лидерам и остаётся доступной для
        отечественных клиентов. Мы используем высокопрочный силиконовый каучук, устойчивый к
        температурам от -60&deg;C до +260&deg;C, агрессивным химическим средам и высокому давлению.
        Все патрубки армированы несколькими слоями полиэстеровой или арамидной (Nomex) ткани, что
        обеспечивает надёжность даже в системах турбонаддува и охлаждения спортивных автомобилей.
      </p>
    </section>

    <section class="about__block">
      <h2>Успех на маркетплейсах</h2>
      <p>
        С 2023 года активно развиваем онлайн-продажи и присутствуем на Ozon, Wildberries и
        Яндекс.Маркете. Покупатели ценят оперативное выполнение заказов и стабильное качество.
      </p>
      <ul>
        <li v-for="advantage in marketplaceAdvantages" :key="advantage">{{ advantage }}</li>
      </ul>
    </section>

    <section class="about__block">
      <h2>Изготовление на заказ</h2>
      <p>
        Мы готовы принять заказ на изготовление силиконовых патрубков по вашим требованиям: от
        стандартных решений до нестандартных форм с оснасткой под конкретный проект.
      </p>
      <div class="about__orders">
        <article>
          <h3>На основе образца</h3>
          <p>
            Вы предоставляете патрубок, который нужно воспроизвести. Мы выполняем измерения и
            готовим оснастку для производства идентичной детали — идеальный вариант для замены
            снятых с производства компонентов.
          </p>
        </article>
        <article>
          <h3>По техническим требованиям</h3>
          <p>
            Опишите условия эксплуатации, нагрузки и температуры. Конструкторский отдел подготовит
            чертёж, подберёт геометрию и марку силикона. Контакты для заказа указаны в разделе
            «Контакты».
          </p>
        </article>
      </div>
    </section>

    <section class="about__block about__packaging">
      <h2>Упаковка</h2>
      <p>
        Упаковка из чёрного рукава из полиэтилена высокого давления (ПВД) защищает продукцию от
        света и повреждений при транспортировке. Каждый комплект герметично запаивается, маркируется
        и сопровождается инструкцией, что обеспечивает сохранность патрубков и готовность к работе
        без дополнительной подготовки.
      </p>
      <img :src="packagingImage" alt="Промышленная упаковка АВТОСИЛИКОН" class="about__packaging-image" />
    </section>
  </div>
</template>

<script setup lang="ts">
import aboutHeroImage from '/placeholder/foto/image5-39.jpeg?url';
import packagingImage from '/placeholder/foto/image6-41-size.jpg?url';

const kpis = [
  { value: '2018', label: 'Год основания' },
  { value: '100+', label: 'Товаров в каталоге' },
  { value: '4.8 / 5', label: 'Средняя оценка' },
  { value: '2+ года', label: 'Опыт на маркетплейсах' },
];

const keyFacts = [
  'Специализируемся на армированных, прямых, переходных и редукционных патрубках.',
  'Работаем с автомобильной, промышленной и тюнинг-индустрией.',
  'Более двух лет активного присутствия на маркетплейсах.',
];

const marketplaceAdvantages = [
  'Постоянное наличие 500+ SKU на складах партнёров.',
  'Прямые поставки от производителя и гарантированное качество.',
  'Высокие рейтинги и отзывы за оперативность и надёжность.',
];
</script>

<style scoped lang="scss">
.about {
  padding: var(--space-6) 0 var(--space-8);
  display: grid;
  gap: var(--space-6);
  overflow-x: hidden;
}

.about__hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--space-6);
  align-items: center;
}

.about__hero-text {
  display: grid;
  gap: var(--space-3);
}

.about__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  color: var(--accent);
}

.about__hero-media {
  margin: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  max-width: 560px;
  justify-self: center;

  img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 420px;
    object-fit: cover;
  }
}

.about__kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-4);
}

.about__kpi {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  text-align: center;
  box-shadow: var(--shadow-sm);
}

.about__kpi-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
}

.about__block {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  display: grid;
  gap: var(--space-3);
  word-break: break-word;

  ul {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: var(--space-2);
  }
}

.about__orders {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));

  article {
    background: var(--bg);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: grid;
    gap: var(--space-2);
  }
}

.about__packaging {
  background: #101010;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.about__packaging-image {
  width: 100%;
  max-width: 720px;
  border-radius: var(--radius-md);
  object-fit: contain;
  max-height: 420px;
  display: block;
  margin: 0 auto;
}

@media (max-width: $breakpoint-tablet) {
  .about {
    padding-top: var(--space-5);
    gap: var(--space-5);
  }

  .about__hero {
    gap: var(--space-4);
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: center;
  }
}

@media (max-width: $breakpoint-mobile) {
  .about {
    padding-top: var(--space-4);
    gap: var(--space-4);
  }

  .about__hero-text {
    text-align: center;
  }

  .about__kpis {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  }

  .about__block {
    padding: var(--space-4);
    text-align: left;
  }

  .about__orders article {
    padding: var(--space-3);
  }

  .about__packaging-image {
    max-height: 320px;
  }
}
</style>
