export const providersConfig = {
  cdek: {
    label: 'CDEK',
    allowedTypes: ['pvz', 'door'],
  },
  ruspost: {
    label: 'Почта России',
    allowedTypes: ['pvz', 'door'],
  },
};

export function isProviderAllowed(provider) {
  return Boolean(providersConfig[provider]);
}

export function isTypeAllowed(provider, type) {
  const providerConfig = providersConfig[provider];
  if (!providerConfig) return false;
  return providerConfig.allowedTypes.includes(type);
}
