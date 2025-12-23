
import { getProvider } from '../../web3/provider.js';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, ERC721_ABI } from '../../lib/constants.js';

let _contract = null;

async function getContract() {
  if (_contract) return _contract;

  const provider = await getProvider();
  _contract = new ethers.Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
  return _contract;
}

/**
 * This is the method to retrieve the informations for a given token ID
 * @param {string} tokenId
 * @returns
 */
export async function fetchTokenDataById(tokenId) {
  try {
    const contract = await getContract();
    const tokenURI = await contract.tokenURI(tokenId);
    if (!tokenURI || tokenURI === "") throw new Error('Invalid token URI');

    // Fetch metadata and current owner in parallel
    const [metadata, currentOwner] = await Promise.all([fetchMetadata(tokenURI), contract.ownerOf(tokenId)]);
    if (!metadata) throw new Error('Failed to fetch metadata');

    return {
      tokenId,
      currentOwner,
      ...metadata
    }
  } catch (error) {
    // Something wrong happened, let's ignore it for now.
    console.error('Error fetching token data:', error);
    return null;
  }
}

/**
 * This is the method to retrieve and parse metadata from a given token URI
 * @param {string} uri
 * @returns
 */
export async function fetchMetadata(uri) {
  if (uri.startsWith('ipfs://')) {
      uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }

  if (uri.startsWith('ar://')) {
      uri = uri.replace('ar://', 'https://arweave.net/');
  }

  const metadata = await fetch(uri).then(res => {
      if (!res.ok) throw new Error('Failed to fetch metadata');
      return res.json();
  });

  const imageUrl = (metadata.image ?? metadata.Image)

  return {
    name: metadata.name ?? metadata.Name ?? 'Unknown',
    description: metadata.description ?? metadata.Description ?? 'No description',
    image: imageUrl ? imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/').replace('ar://', 'https://arweave.net/') : null,
    attributes: metadata.attributes ?? metadata.Attributes ?? []
  }

}
