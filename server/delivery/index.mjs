import { isProviderAllowed, isTypeAllowed } from './config.mjs';
import * as cdek from './providers/cdek.mjs';
import * as ruspost from './providers/ruspost.mjs';

const providerMap = {
  cdek,
  ruspost,
};

export async function searchPvz(options) {
  const provider = normalizeProvider(options?.provider);
  const handler = providerMap[provider];
  if (!handler?.searchPvz) {
    throw new Error(`Провайдер ${provider} не поддерживает поиск ПВЗ.`);
  }
  return handler.searchPvz(options ?? {});
}

export async function calculate(options) {
  const provider = normalizeProvider(options?.provider);
  const type = normalizeType(provider, options?.type);
  const handler = providerMap[provider];
  if (!handler?.calculate) {
    throw new Error(`Провайдер ${provider} не поддерживает расчёт доставки.`);
  }
  return handler.calculate({ ...options, provider, type });
}

function normalizeProvider(provider) {
  const key = typeof provider === 'string' ? provider.toLowerCase() : '';
  if (!isProviderAllowed(key)) {
    throw new Error('Недопустимый провайдер доставки.');
  }
  return key;
}

function normalizeType(provider, type) {
  const key = typeof type === 'string' ? type.toLowerCase() : '';
  if (!isTypeAllowed(provider, key)) {
    throw new Error('Недопустимый тип доставки для выбранного провайдера.');
  }
  return key;
}
