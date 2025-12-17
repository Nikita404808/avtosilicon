const indexes = process.argv.slice(2).map((arg) => String(arg ?? '').trim()).filter(Boolean);

if (!indexes.length) {
  console.error('Usage: node scripts/find-ruspost-origin.mjs <index1> <index2> ...');
  console.error('Example: node scripts/find-ruspost-origin.mjs 190000 195000 197000');
  process.exit(1);
}

const baseUrl = process.env.API_BASE?.trim() || `http://localhost:${process.env.PORT || 3000}`;
const url = new URL('/api/delivery/calculate', baseUrl);

for (const index of indexes) {
  const normalized = normalizeIndex(index);
  if (!normalized) {
    console.log(`${index} -> FAIL (invalid index)`);
    continue;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        provider: 'ruspost',
        type: 'pvz',
        total_weight: 0.5,
        pickup_point_id: '101000',
        provider_metadata: {
          from_index: normalized,
        },
      }),
    });

    const payload = await safeJson(response);
    if (response.ok) {
      const price = payload?.delivery_price ?? null;
      const eta = payload?.delivery_eta ?? null;
      console.log(`${normalized} -> OK (${price}/${eta ?? '-'})`);
      continue;
    }

    const errorCode = payload?.error_code ?? payload?.errorCode ?? payload?.code ?? null;
    const msg = payload?.message ?? payload?.error ?? JSON.stringify(payload);
    console.log(`${normalized} -> FAIL (${[errorCode, msg].filter(Boolean).join(' ')})`);
  } catch (error) {
    console.log(`${normalized} -> FAIL (${String(error?.message ?? error)})`);
  }
}

function normalizeIndex(value) {
  const raw = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  const digits = raw.replace(/\s+/g, '');
  return /^\d{5,6}$/.test(digits) ? digits : null;
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return { message: text };
  }
}
