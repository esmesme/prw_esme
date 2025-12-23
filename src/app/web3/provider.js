import { ethers } from 'ethers';
import { MAINNET_RPC_ENDPOINTS, BASE_RPC_ENDPOINTS } from '../lib/constants.js';

let provider = null;


export async function getProvider(net = "base") {
  // * Short-circuit if we already have a provider
  if (provider) return provider;

  const rpc_list = net === 'mainnet' ? MAINNET_RPC_ENDPOINTS : BASE_RPC_ENDPOINTS;

  for (const rpcUrl of rpc_list) {
    try {
      const testProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
      await testProvider.getBlockNumber();
      provider = testProvider;
      return provider;
    } catch (_) {}
  }
  return null;
}
