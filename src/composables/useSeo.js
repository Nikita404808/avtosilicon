import { onBeforeUnmount, toValue, watchEffect } from 'vue';
import { applySeo } from '@/services/seo';
export const useSeo = (input) => {
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
