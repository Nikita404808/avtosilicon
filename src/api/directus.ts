const DEFAULT_DIRECTUS_URL = 'http://31.31.207.27:8055';

type DirectusProductRecord = {
  id: number;
  name?: string | null;
  slug?: string | null;
  sku?: string | null;
  price?: string | number | null;
  brand?: string | null;
  car_brand?: string | null;
  car_model?: string | null;
  description?: string | null;
  image?: string | null;
  in_stock?: boolean | null;
  inner_diameter?: string | number | null;
  code?: string | null;
  material?: string | null;
  series?: string | null;
  transport_type?: string | null;
  barcode?: string | null;
  weight_kg?: string | number | null;
  categories?: string[] | null;
};

type DirectusCollectionResponse<T> = {
  data?: T[];
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

const slugify = (rawName: string, id: number): string => {
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

export interface Product {
  id: number;
  slug: string;
  name: string;
  title: string;
  legacyId?: string | null;
  sku: string | null;
  price: number | null;
  brand: string | null;
  carBrand: string | null;
  carModel: string | null;
  description: string | null;
  descriptionHtml: string;
  image: string | null;
  images: string[];
  innerDiameter: number | null;
  inStock: boolean;
  categories: string[];
  compatibility: string[];
  code: string | null;
  material: string | null;
  series: string | null;
  transportType: string | null;
  barcode: string | null;
  weightKg: number | null;
}

const mapProduct = (record: DirectusProductRecord): Product => {
  const name = record.name?.trim() || 'Без названия';
  const slug = record.slug?.trim() || slugify(name, record.id);
  const price = normalizeNumber(record.price);
  const innerDiameter = normalizeNumber(record.inner_diameter);
  const compatibility = [record.car_brand, record.car_model].filter(
    (value): value is string => Boolean(value && value.trim()),
  );

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

export async function fetchProducts(): Promise<Product[]> {
  const baseUrl = getBaseUrl().replace(/\/$/, '');
  const url = `${baseUrl}/items/Products`;

  try {
    const response = await fetch(url);
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
