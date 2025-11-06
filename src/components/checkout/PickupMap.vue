<template>
  <div ref="mapContainer" class="pickup-map" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, shallowRef } from 'vue';
import type { DeliveryServiceId, PickupPoint, MapBounds } from '@/types/pickup';

const props = defineProps<{
  provider: DeliveryServiceId;
  points: PickupPoint[];
  selectedPointId: string | null;
}>();

const emit = defineEmits<{
  (event: 'update:bounds', bounds: MapBounds): void;
  (event: 'select', pointId: string): void;
  (event: 'ready'): void;
}>();

const mapContainer = ref<HTMLDivElement | null>(null);
const mapInstance = shallowRef<any>(null);
const placemarks = new Map<string, any>();
let ymapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    ymaps?: any;
  }
}

watch(
  () => props.points,
  () => {
    renderPoints();
  },
  { deep: true },
);

watch(
  () => props.selectedPointId,
  (next) => {
    highlightPoint(next);
  },
);

onMounted(() => {
  initMap();
});

onUnmounted(() => {
  disposeMap();
});

async function initMap() {
  if (!mapContainer.value) return;
  const ymaps = await ensureYmaps();
  const initialCenter: [number, number] = [55.751244, 37.618423];

  mapInstance.value = new ymaps.Map(mapContainer.value, {
    center: initialCenter,
    zoom: 4,
    controls: ['zoomControl', 'fullscreenControl'],
  });

  mapInstance.value.events.add('boundschange', () => {
    const bounds = mapInstance.value.getBounds();
    if (!bounds) return;
    emit('update:bounds', boundsToMapBounds(bounds));
  });

  emit('update:bounds', boundsToMapBounds(mapInstance.value.getBounds()));
  emit('ready');
  renderPoints();
}

async function ensureYmaps(): Promise<any> {
  if (window.ymaps) return window.ymaps;
  if (!ymapsPromise) {
    ymapsPromise = new Promise((resolve, reject) => {
      const apiKey = import.meta.env.VITE_YMAPS_API_KEY;
      const script = document.createElement('script');
      script.src = `https://api-maps.yandex.ru/2.1/?lang=ru_RU${apiKey ? `&apikey=${apiKey}` : ''}`;
      script.async = true;
      script.onerror = () => reject(new Error('Не удалось загрузить Yandex Maps API'));
      script.onload = () => {
        if (window.ymaps) {
          window.ymaps.ready(() => resolve(window.ymaps));
        } else {
          reject(new Error('Yandex Maps не инициализирован'));
        }
      };
      document.head.appendChild(script);
    });
  }
  return ymapsPromise;
}

function renderPoints() {
  const ymaps = window.ymaps;
  if (!mapInstance.value || !ymaps) return;

  mapInstance.value.geoObjects.removeAll();
  placemarks.clear();

  props.points.forEach((point) => {
    const placemark = new ymaps.Placemark([point.lat, point.lng], {
      balloonContentHeader: point.name,
      balloonContentBody: point.address,
    });

    placemark.events.add('click', () => {
      emit('select', point.id);
    });

    mapInstance.value.geoObjects.add(placemark);
    placemarks.set(point.id, placemark);
  });

  highlightPoint(props.selectedPointId);
}

function highlightPoint(pointId: string | null) {
  const ymaps = window.ymaps;
  if (!ymaps) return;
  placemarks.forEach((placemark, id) => {
    if (id === pointId) {
      placemark.options.set('preset', 'islands#violetIcon');
    } else {
      placemark.options.set('preset', 'islands#blueIcon');
    }
  });
}

function boundsToMapBounds(bounds: [[number, number], [number, number]]): MapBounds {
  const [[southLat, westLng], [northLat, eastLng]] = bounds;
  return {
    southWest: { lat: southLat, lng: westLng },
    northEast: { lat: northLat, lng: eastLng },
  };
}

function disposeMap() {
  if (mapInstance.value) {
    mapInstance.value.destroy();
    mapInstance.value = null;
  }
  placemarks.clear();
}
</script>

<style scoped lang="scss">
.pickup-map {
  width: 100%;
  min-height: 320px;
  border-radius: var(--radius-md);
  background: rgba(0, 0, 0, 0.06);
}
</style>
