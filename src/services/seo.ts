import type { RouteLocationNormalizedLoaded, RouteLocationRaw } from 'vue-router';
import { getDirectusAssetUrl } from '@/api/directus';

const BRAND_NAME = 'Автосиликон';
const CANONICAL_ORIGIN = 'https://автосиликон.рф';
const DEFAULT_TITLE = 'Автосиликон — производство силиконовых патрубков | Балаково, доставка по РФ';
const DEFAULT_DESCRIPTION =
  'Производство армированных силиконовых патрубков для авто, спецтехники и промышленности. Балаково. Доставка по России. Тел: +7 (906) 153-02-22';
const DEFAULT_OG_LOCALE = 'ru_RU';
const DEFAULT_OG_SITE_NAME = BRAND_NAME;
const DEFAULT_ROBOTS = 'index,follow';
const DEFAULT_OG_IMAGE_ID =
  'Iv2dZktlub8MxXTUgTDXa8T5v6mpcFWRCj5UL3tnAIyT6sIXLWF0tcZfxSpyNfYHgjjOJIDVR_rpIKSkkEPzDI67.jpg';
const DEFAULT_ICON = '/favicon.png';

export type SeoPayload = {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogType?: string;
  ogImage?: string | null;
  ogUrl?: string;
  ogSiteName?: string;
  ogLocale?: string;
  twitterCard?: string;
  twitterImage?: string | null;
  twitterTitle?: string;
  twitterDescription?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[] | null;
};

const getDefaultOgImage = (): string => {
  const directusUrl = getDirectusAssetUrl(DEFAULT_OG_IMAGE_ID);
  return directusUrl ?? `${CANONICAL_ORIGIN}/favicon.ico`;
};

const defaultOgImage = getDefaultOgImage();

const ensureMetaTag = (selector: string, attributes: Record<string, string | null>) => {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  const existing = head.querySelector(selector) as HTMLMetaElement | null;
  const element = existing ?? document.createElement('meta');
  Object.entries(attributes).forEach(([key, value]) => {
    if (value === null) {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, value);
  });
  if (!existing) {
    head.appendChild(element);
  }
};

const ensureLinkTag = (rel: string, href: string | null, type?: string) => {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  let link = head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!href) {
    if (link) {
      link.remove();
    }
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    head.appendChild(link);
  }
  link.setAttribute('href', href);
  if (type) {
    link.setAttribute('type', type);
  }
};

const normalizePathname = (pathname: string) => {
  if (!pathname.startsWith('/')) return `/${pathname}`;
  return pathname;
};

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');

export const buildCanonicalFromRoute = (
  route?: RouteLocationNormalizedLoaded,
  allowedParams: string[] = [],
): string => {
  const origin = normalizeOrigin(CANONICAL_ORIGIN);

  const pathname =
    route && typeof route.path === 'string'
      ? normalizePathname(route.path)
      : typeof window !== 'undefined'
        ? normalizePathname(window.location.pathname)
        : '/';

  const canonicalUrl = new URL(pathname, origin);
  const params = new URLSearchParams();

  const appendAllowedParams = (query: unknown) => {
    if (!query || typeof query !== 'object') return;
    for (const key of allowedParams) {
      const value = (query as Record<string, unknown>)[key];
      if (typeof value === 'string' && value) {
        params.set(key, value);
      } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        params.set(key, value[0]);
      }
    }
  };

  if (route?.query) {
    appendAllowedParams(route.query);
  } else if (typeof window !== 'undefined') {
    const currentSearch = new URLSearchParams(window.location.search);
    allowedParams.forEach((param) => {
      const value = currentSearch.get(param);
      if (value) params.set(param, value);
    });
  }

  const search = params.toString();
  canonicalUrl.search = search ? `?${search}` : '';
  return canonicalUrl.toString();
};

const applyIcons = (_iconUrl: string) => {
  const url = DEFAULT_ICON;
  ensureLinkTag('icon', url, 'image/png');
  ensureLinkTag('shortcut icon', url, 'image/png');
  ensureLinkTag('apple-touch-icon', '/apple-touch-icon.png');
};

const setJsonLd = (data: SeoPayload['jsonLd']) => {
  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) return;
  const id = 'seo-jsonld';
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    existing?.remove();
    return;
  }
  const script: HTMLScriptElement = existing ?? document.createElement('script');
  script.type = 'application/ld+json';
  script.id = id;
  script.textContent = JSON.stringify(data, null, 2);
  if (!existing) {
    head.appendChild(script);
  }
};

export const applySeo = (payload: SeoPayload = {}) => {
  const canonical = payload.canonical ?? buildCanonicalFromRoute();
  const title = payload.title?.trim() || DEFAULT_TITLE;
  const description = payload.description?.trim() || DEFAULT_DESCRIPTION;
  const robots = payload.robots?.trim() || DEFAULT_ROBOTS;
  const ogImage = payload.ogImage ?? defaultOgImage;
  const ogUrl = payload.ogUrl ?? canonical;
  const ogType = payload.ogType ?? 'website';
  const twitterImage = payload.twitterImage ?? ogImage;
  const twitterCard = payload.twitterCard ?? 'summary_large_image';
  const ogSiteName = payload.ogSiteName ?? DEFAULT_OG_SITE_NAME;
  const ogLocale = payload.ogLocale ?? DEFAULT_OG_LOCALE;

  document.title = title;
  ensureMetaTag('meta[name="description"]', { name: 'description', content: description });
  ensureMetaTag('meta[name="robots"]', { name: 'robots', content: robots });
  ensureLinkTag('canonical', canonical);

  ensureMetaTag('meta[property="og:title"]', { property: 'og:title', content: title });
  ensureMetaTag('meta[property="og:description"]', { property: 'og:description', content: description });
  ensureMetaTag('meta[property="og:type"]', { property: 'og:type', content: ogType });
  ensureMetaTag('meta[property="og:url"]', { property: 'og:url', content: ogUrl });
  ensureMetaTag('meta[property="og:image"]', { property: 'og:image', content: ogImage });
  ensureMetaTag('meta[property="og:site_name"]', { property: 'og:site_name', content: ogSiteName });
  ensureMetaTag('meta[property="og:locale"]', { property: 'og:locale', content: ogLocale });

  ensureMetaTag('meta[name="twitter:card"]', { name: 'twitter:card', content: twitterCard });
  ensureMetaTag('meta[name="twitter:title"]', { name: 'twitter:title', content: payload.twitterTitle ?? title });
  ensureMetaTag('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: payload.twitterDescription ?? description,
  });
  ensureMetaTag('meta[name="twitter:image"]', { name: 'twitter:image', content: twitterImage });

  applyIcons(ogImage);
  setJsonLd(payload.jsonLd ?? null);
};

export const getDefaultSeo = (): Required<Pick<SeoPayload, 'title' | 'description' | 'robots'>> => ({
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  robots: DEFAULT_ROBOTS,
});

export const getBrandName = () => BRAND_NAME;
export const getDefaultOgImageUrl = () => defaultOgImage;
export const getCanonicalOrigin = () => CANONICAL_ORIGIN;
