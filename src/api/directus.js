const DEFAULT_DIRECTUS_URL = 'http://31.31.207.27:8055';
const normalizeNumber = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const slugify = (rawName, id) => {
    const source = rawName.toString().trim().toLowerCase();
    const normalized = source
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
    return `${id}-${normalized || 'product'}`;
};
const getBaseUrl = () => {
    const fromEnv = import.meta.env.VITE_DIRECTUS_URL;
    return (typeof fromEnv === 'string' && fromEnv.trim()) || DEFAULT_DIRECTUS_URL;
};
const mapProduct = (record) => {
    const name = record.name?.trim() || 'Без названия';
    const slug = record.slug?.trim() || slugify(name, record.id);
    const price = normalizeNumber(record.price);
    const innerDiameter = normalizeNumber(record.inner_diameter);
    const compatibility = [record.car_brand, record.car_model].filter((value) => Boolean(value && value.trim()));
    return {
        id: record.id,
        slug,
        name,
        title: name,
        legacyId: null,
        sku: record.sku?.trim() || null,
        price,
        brand: record.brand?.trim() || null,
        carBrand: record.car_brand?.trim() || null,
        carModel: record.car_model?.trim() || null,
        description: record.description ?? null,
        descriptionHtml: record.description ?? '',
        image: record.image ?? null,
        images: record.image ? [record.image] : [],
        innerDiameter,
        inStock: Boolean(record.in_stock),
        categories: Array.isArray(record.categories) ? record.categories.filter(Boolean) : [],
        compatibility,
        code: record.code?.trim() || null,
        material: record.material?.trim() || null,
        series: record.series?.trim() || null,
        transportType: record.transport_type?.trim() || null,
        barcode: record.barcode?.trim() || null,
        weightKg: normalizeNumber(record.weight_kg),
    };
};
export async function fetchProducts() {
    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const url = `${baseUrl}/items/Products`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const message = await response.text();
            console.error(`[Directus] Failed to fetch products: ${response.status} ${response.statusText}. ${message}`);
            return [];
        }
        const payload = (await response.json());
        if (!payload.data || !Array.isArray(payload.data)) {
            console.error('[Directus] Unexpected payload shape for products list');
            return [];
        }
        return payload.data.map(mapProduct);
    }
    catch (error) {
        console.error('[Directus] Unexpected error while fetching products', error);
        return [];
    }
}
