import type { NewsItem } from '@/types/news';

const DEFAULT_DIRECTUS_URL = 'https://автосиликон.рф/directus';

type DirectusFileField = string | { id?: string | number | null } | null;

type DirectusCarModelRecord = {
  id: number | string;
  name?: string | null;
  image?: DirectusFileField;
};

type DirectusPartTypeRecord = {
  id: number | string;
  name?: string | null;
};

type DirectusProductRecord = {
  id: number;
  name?: string | null;
  slug?: string | null;
  sku?: string | null;
  price?: string | number | null;
  brand?: string | null;
  car_model?: DirectusCarModelRecord | number | string | null;
  description?: string | null;
  image?: DirectusFileField;
  in_stock?: boolean | null;
  inner_diameter?: string | number | null;
  code?: string | null;
  material?: string | null;
  color?: string | null;
  series?: string | null;
  transport_type?: string | null;
  barcode?: string | null;
  weight?: string | number | null;
  weight_kg?: string | number | null;
  categories?: string[] | null;
  created_at?: string | null;
  is_new?: boolean | null;
  isNew?: boolean | null;
  part_type?: DirectusPartTypeRecord | number | string | null;
  part_types?: DirectusPartTypeRecord | number | string | null;
};

type DirectusCollectionResponse<T> = {
  data?: T[];
};

type DirectusNewsRecord = {
  id: number;
  title?: string | null;
  content?: string | null;
  date?: string | null;
  image?: string | null;
};

const PRODUCT_FIELDS = [
  '*',
  'car_model.id',
  'car_model.name',
  'car_model.image',
  'part_type.id',
  'part_type.name',
  'part_types.id',
  'part_types.name',
] as const;
const CAR_MODEL_FIELDS = ['id', 'name', 'image'] as const;
const PART_TYPE_FIELDS = ['id', 'name'] as const;
const PART_TYPE_COLLECTIONS = ['PartTypes', 'part_types'] as const;

const appendFields = (url: URL, fields: readonly string[]) => {
  fields.forEach((field) => url.searchParams.append('fields[]', field));
};

const normalizeNumber = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const coerceNumberOrString = (
  value: string | number | null | undefined,
): number | string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  return null;
};

const slugify = (rawName: string, id: number, fallback = 'item'): string => {
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

export function getDirectusAssetUrl(id?: string | null): string | null {
  if (!id) return null;
  const baseUrl = getDirectusBaseUrl();
  return `${baseUrl}/assets/${id}`;
}

const resolveAssetId = (file: DirectusFileField | undefined): string | null => {
  if (!file) return null;
  if (typeof file === 'string') {
    return file;
  }
  if (typeof file === 'object' && file !== null) {
    const maybeId = file.id;
    if (typeof maybeId === 'string') return maybeId;
    if (typeof maybeId === 'number') return String(maybeId);
  }
  return null;
};

export interface CarModelRef {
  id: number | string;
  name: string;
  image?: string | null; // уже готовый URL
}

export interface PartTypeRef {
  id: number | string;
  name: string;
}

export interface Product {
  id: number | string;
  slug: string;
  name: string;
  title: string;
  legacyId?: string | null;
  sku?: string | null;
  price: number | null;
  brand?: string | null;
  description?: string | null;
  descriptionHtml: string;
  image: string | null;
  images: string[];
  inStock: boolean;

  carModel?: CarModelRef | null;
  partType?: PartTypeRef | null;

  code?: string | null;
  material?: string | null;
  color?: string | null;
  transportType?: string | null;
  barcode?: string | null;
  weight?: number | string | null;
  innerDiameter?: number | string | null;
  createdAt?: string | null;
  isNew?: boolean;

  categories?: string[];
  series?: string | null;
}

const mapProduct = (record: DirectusProductRecord): Product => {
  const name = record.name?.trim() || 'Без названия';
  const slug = record.slug?.trim() || slugify(name, record.id, 'product');
  const price = normalizeNumber(record.price);
  const innerDiameter = coerceNumberOrString(record.inner_diameter);
  const weight = coerceNumberOrString(record.weight ?? record.weight_kg);
  const rawCarModel =
    typeof record.car_model === 'object' && record.car_model !== null ? record.car_model : null;
  const carModelImageId = resolveAssetId(rawCarModel?.image);
  const carModelRef: CarModelRef | null = rawCarModel
    ? {
        id: rawCarModel.id,
        name: rawCarModel.name?.trim() || `Модель ${rawCarModel.id}`,
        image: carModelImageId ? getDirectusAssetUrl(carModelImageId) : null,
      }
    : null;

  const rawPartType =
    typeof record.part_type === 'object' && record.part_type !== null
      ? record.part_type
      : typeof record.part_types === 'object' && record.part_types !== null
        ? record.part_types
        : null;
  const partTypeRef: PartTypeRef | null = rawPartType
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

export async function fetchProducts(): Promise<Product[]> {
  const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
  const url = new URL(`${baseUrl}/items/Products`);
  appendFields(url, PRODUCT_FIELDS);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      const message = await response.text();
      console.error(
        `[Directus] Failed to fetch products: ${response.status} ${response.statusText}. ${message}`,
      );
      return [];
    }

    const payload = (await response.json()) as DirectusCollectionResponse<DirectusProductRecord>;
    if (!payload.data || !Array.isArray(payload.data)) {
      console.error('[Directus] Unexpected payload shape for products list');
      return [];
    }

    return payload.data.map(mapProduct);
  } catch (error) {
    console.error('[Directus] Unexpected error while fetching products', error);
    return [];
  }
}

export async function fetchNewProducts(limit = 5): Promise<Product[]> {
  const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
  const url = new URL(`${baseUrl}/items/Products`);

  url.searchParams.set('filter[isNew][_eq]', 'true');
  url.searchParams.set('sort[]', '-date_created');
  url.searchParams.set('limit', String(limit));
  appendFields(url, PRODUCT_FIELDS);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    console.error('Failed to fetch new products', { error, url: url.toString() });
    throw new Error('Не удалось загрузить новинки');
  }

  let json: DirectusCollectionResponse<DirectusProductRecord> | null = null;
  try {
    json = (await response.json()) as DirectusCollectionResponse<DirectusProductRecord>;
  } catch {
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

const mapCarModelRef = (record: DirectusCarModelRecord): CarModelRef => {
  const imageId = resolveAssetId(record.image);
  return {
    id: record.id,
    name: record.name?.trim() || `Модель ${record.id}`,
    image: imageId ? getDirectusAssetUrl(imageId) : null,
  };
};

export async function fetchCarModels(): Promise<CarModelRef[]> {
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
    const payload = (await response.json()) as DirectusCollectionResponse<DirectusCarModelRecord>;
    return Array.isArray(payload.data) ? payload.data.map(mapCarModelRef) : [];
  } catch (error) {
    console.error('[Directus] Unexpected error while fetching car models', error);
    return [];
  }
}

const mapPartTypeRef = (record: DirectusPartTypeRecord): PartTypeRef => ({
  id: record.id,
  name: record.name?.trim() || `Категория ${record.id}`,
});

export async function fetchPartTypes(): Promise<PartTypeRef[]> {
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
      const payload = (await response.json()) as DirectusCollectionResponse<DirectusPartTypeRecord>;
      if (Array.isArray(payload.data)) {
        return payload.data.map(mapPartTypeRef);
      }
    } catch (error) {
      console.error('[Directus] Unexpected error while fetching part types', {
        collection: collectionName,
        error,
      });
    }
  }
  return [];
}

const mapNewsItem = (record: DirectusNewsRecord): NewsItem => ({
  id: record.id,
  slug: slugify(record.title ?? '', record.id, 'news'),
  title: record.title?.trim() || 'Без названия',
  content: typeof record.content === 'string' ? record.content : '',
  date: record.date ?? '',
  image: getDirectusAssetUrl(record.image),
});

export async function fetchNews(): Promise<NewsItem[]> {
  const baseUrl = getDirectusBaseUrl().replace(/\/$/, '');
  const url = new URL(`${baseUrl}/items/News`);
  url.searchParams.set('sort[]', '-date');

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    console.error('Failed to fetch news', { error, url: url.toString() });
    throw new Error('Не удалось загрузить новости');
  }

  let json: DirectusCollectionResponse<DirectusNewsRecord> | null = null;
  try {
    json = (await response.json()) as DirectusCollectionResponse<DirectusNewsRecord>;
  } catch {
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
