import { onBeforeUnmount, toValue, watchEffect } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { applySeo } from '@/services/seo';
import type { SeoPayload } from '@/services/seo';

export const useSeo = (input: MaybeRefOrGetter<SeoPayload>) => {
  watchEffect(() => {
    const meta = toValue(input);
    applySeo(meta);
  });

  onBeforeUnmount(() => {
    const meta = toValue(input);
    if (meta?.jsonLd) {
      applySeo({ jsonLd: null });
    }
  });
};
