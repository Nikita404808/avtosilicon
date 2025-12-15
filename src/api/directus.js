const DEFAULT_DIRECTUS_URL = 'http://79.174.85.129:8055';
const PRODUCT_FIELDS = [
    '*',
    'car_model.id',
    'car_model.name',
    'car_model.image',
    'part_type.id',
    'part_type.name',
    'part_types.id',
    'part_types.name',
];
const CAR_MODEL_FIELDS = ['id', 'name', 'image'];
const PART_TYPE_FIELDS = ['id', 'name'];
const PART_TYPE_COLLECTIONS = ['PartTypes', 'part_types'];
const appendFields = (url, fields) => {
    fields.forEach((field) => url.searchParams.append('fields[]', field));
};
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
const normalizeString = (value) => {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed || null;
};
const coerceNumberOrString = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    return null;
};
const slugify = (rawName, id, fallback = 'item') => {
    const source = rawName.toString().trim().toLowerCase();
    const normalized = source
        .replace(/[^a-z0-9а-яё]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
    return `${id}-${normalized || fallback}`;
};
const getDirectusBaseUrl = () => {
    const fromEnv = import.meta.env.VITE_DIRECTUS_URL;
    return (typeof fromEnv === 'string' && fromEnv.trim()) || DEFAULT_DIRECTUS_URL;
};
export function getDirectusAssetUrl(id) {
    if (!id)
        return null;
    const baseUrl = getDirectusBaseUrl();
    return `${baseUrl}/assets/${id}`;
}
const resolveAssetId = (file) => {
    if (!file)
        return null;
    if (typeof file === 'string') {
        return file;
    }
    if (typeof file === 'object' && file !== null) {
        const maybeId = file.id;
        if (typeof maybeId === 'string')
            return maybeId;
        if (typeof maybeId === 'number')
            return String(maybeId);
    }
    return null;
};
const mapProduct = (record) => {
    const name = record.name?.trim() || 'Без названия';
    const slug = record.slug?.trim() || slugify(name, record.id, 'product');
    const price = normalizeNumber(record.price);
    const innerDiameter = coerceNumberOrString(record.inner_diameter);
    const weight = coerceNumberOrString(record.weight ?? record.weight_kg);
    const rawCarModel = typeof record.car_model === 'object' && record.car_model !== null ? record.car_model : null;
    const carModelImageId = resolveAssetId(rawCarModel?.image);
    const carModelRef = rawCarModel
        ? {
            id: rawCarModel.id,
            name: rawCarModel.name?.trim() || `Модель ${rawCarModel.id}`,
            image: carModelImageId ? getDirectusAssetUrl(carModelImageId) : null,
        }
        : null;
    const rawPartType = typeof record.part_type === 'object' && record.part_type !== null
        ? record.part_type
        : typeof record.part_types === 'object' && record.part_types !== null
            ? record.part_types
            : null;
    const partTypeRef = rawPartType
        ? {
            id: rawPartType.id,
            name: rawPartType.name?.trim() || `Категория ${rawPartType.id}`,
        }
        : null;
    const productImageId = resolveAssetId(record.image);
    const imageUrl = getDirectusAssetUrl(productImageId);
    const createdAt = record.created_at ?? undefined;
    const isNew = Boolean(record.isNew ?? record.is_new);
    return {
        id: record.id,
        slug,
        name,
        title: name,
        legacyId: null,
        sku: record.sku?.trim() || null,
        price,
        brand: record.brand?.trim() || null,
        carModel: carModelRef,
        partType: partTypeRef,
        description: record.description ?? null,
        descriptionHtml: record.description ?? '',
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
        innerDiameter,
        inStock: Boolean(record.in_stock),
        categories: Array.isArray(record.categories) ? record.categories.filter(Boolean) : [],
        code: normalizeString(record.code),
        material: normalizeString(record.material),
        color: normalizeString(record.color),
        series: normalizeString(record.series),
        transportType: normalizeString(record.transport_type),
        barcode: normalizeString(record.barcode),
        weight,
        createdAt,
        isNew,
    };
};
export async function fetchProducts() {
    const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
    const url = new URL(`${baseUrl}/items/Products`);
    appendFields(url, PRODUCT_FIELDS);
    try {
        const response = await fetch(url.toString());
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
export async function fetchNewProducts(limit = 5) {
    const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
    const url = new URL(`${baseUrl}/items/Products`);
    url.searchParams.set('filter[isNew][_eq]', 'true');
    url.searchParams.set('sort[]', '-date_created');
    url.searchParams.set('limit', String(limit));
    appendFields(url, PRODUCT_FIELDS);
    let response;
    try {
        response = await fetch(url.toString());
    }
    catch (error) {
        console.error('Failed to fetch new products', { error, url: url.toString() });
        throw new Error('Не удалось загрузить новинки');
    }
    let json = null;
    try {
        json = (await response.json());
    }
    catch {
        json = null;
    }
    if (!response.ok) {
        console.error('Failed to fetch new products', {
            status: response.status,
            statusText: response.statusText,
            body: json,
            url: url.toString(),
        });
        throw new Error('Не удалось загрузить новинки');
    }
    const items = Array.isArray(json?.data) ? json.data : [];
    return items.map(mapProduct);
}
const mapCarModelRef = (record) => {
    const imageId = resolveAssetId(record.image);
    return {
        id: record.id,
        name: record.name?.trim() || `Модель ${record.id}`,
        image: imageId ? getDirectusAssetUrl(imageId) : null,
    };
};
export async function fetchCarModels() {
    const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
    const url = new URL(`${baseUrl}/items/CarModels`);
    url.searchParams.set('sort[]', 'name');
    appendFields(url, CAR_MODEL_FIELDS);
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error('[Directus] Failed to fetch car models', {
                status: response.status,
                statusText: response.statusText,
            });
            return [];
        }
        const payload = (await response.json());
        return Array.isArray(payload.data) ? payload.data.map(mapCarModelRef) : [];
    }
    catch (error) {
        console.error('[Directus] Unexpected error while fetching car models', error);
        return [];
    }
}
const mapPartTypeRef = (record) => ({
    id: record.id,
    name: record.name?.trim() || `Категория ${record.id}`,
});
export async function fetchPartTypes() {
    const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
    for (const collectionName of PART_TYPE_COLLECTIONS) {
        const url = new URL(`${baseUrl}/items/${collectionName}`);
        url.searchParams.set('sort[]', 'name');
        appendFields(url, PART_TYPE_FIELDS);
        try {
            const response = await fetch(url.toString());
            if (!response.ok) {
                console.error('[Directus] Failed to fetch part types', {
                    collection: collectionName,
                    status: response.status,
                    statusText: response.statusText,
                });
                continue;
            }
            const payload = (await response.json());
            if (Array.isArray(payload.data)) {
                return payload.data.map(mapPartTypeRef);
            }
        }
        catch (error) {
            console.error('[Directus] Unexpected error while fetching part types', {
                collection: collectionName,
                error,
            });
        }
    }
    return [];
}
const mapNewsItem = (record) => ({
    id: record.id,
    slug: slugify(record.title ?? '', record.id, 'news'),
    title: record.title?.trim() || 'Без названия',
    content: typeof record.content === 'string' ? record.content : '',
    date: record.date ?? '',
    image: getDirectusAssetUrl(record.image),
});
export async function fetchNews() {
    const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
    const url = new URL(`${baseUrl}/items/News`);
    url.searchParams.set('sort[]', '-date');
    let response;
    try {
        response = await fetch(url.toString());
    }
    catch (error) {
        console.error('Failed to fetch news', { error, url: url.toString() });
        throw new Error('Не удалось загрузить новости');
    }
    let json = null;
    try {
        json = (await response.json());
    }
    catch {
        json = null;
    }
    if (!response.ok) {
        console.error('Failed to fetch news', {
            status: response.status,
            statusText: response.statusText,
            body: json,
            url: url.toString(),
        });
        throw new Error('Не удалось загрузить новости');
    }
    const items = Array.isArray(json?.data) ? json.data : [];
    return items.map(mapNewsItem);
}
