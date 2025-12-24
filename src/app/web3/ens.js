import { getProvider } from './provider.js';

export async function resolveENS(address) {
  const addressLower = address.toLowerCase();

  const provider = await getProvider("mainnet");

  // Resolve from the provider
  if (provider) {
    const ensName = await provider.lookupAddress(addressLower).catch(() => null);
    if (ensName) return ensName;
  }

  // Resolve from an Pugson API
  const response = await fetch(`https://api.ensdata.net/${addressLower}`).then(res => {
    if (!res.ok) throw new Error('Failed to fetch ENS data');
    return res.json();
  }).then(data => data.ens).catch(() => null);

  return response;
}
