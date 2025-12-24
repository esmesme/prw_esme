import { Contract } from "ethers/contract";
import { CONTRACT_ADDRESS, ERC721_ABI } from "../../lib/constants.js";
import { getProvider } from "../../web3/provider.js";

const max_token = 49;
let _contract = null;

async function getContract() {
  if (_contract) return _contract;

  const provider = await getProvider();
  _contract = new Contract(CONTRACT_ADDRESS, ERC721_ABI, provider);
  return _contract;
}

/**
 * This method is in charge of loading all tokens for the contract.
 * Each time a token is loaded, we call the callback function if provided
 * Enabling to progressively render tokens as they are loaded
 * @param {function} cb
 * @returns
 */
export async function loadTokens(cb) {
  const tokens = [];

  const ids = Array.from({ length: max_token + 1 }, (_, i) => i + 1);

  for await (const token of fetchTokens(ids)) {
    if (!token) continue;

    tokens.push(token);
    cb?.(token);
  }

  console.log(`Successfully loaded ${tokens.length} tokens.`);
  return tokens;
}

/**
 * This method is an async generator to fetch tokens by their IDs with error handling
 * If we can't fetch 3 tokens in a row, we stop the process, avoiding fetching unreachable tokens
 * @param {Array<string>} ids
 */
async function* fetchTokens(ids) {
  let errorTrehshold = 3;
  for (const id of ids) {
    try {
      const token = await fetchTokenDataById(id);
      if (errorTrehshold < 3) errorTrehshold = 3; // reset error threshold on success
      yield token;
    } catch (error) {
      console.error(`Error fetching token ID ${id}:`, error);
      errorTrehshold--;

      if (errorTrehshold <= 0) {
        // "Maximum error threshold reached. Stopping further token fetches."
        break;
      }
    }
  }
}

/**
 * This is the method to retrieve the informations for a given token ID
 * @param {string} tokenId
 * @returns
 */
export async function fetchTokenDataById(tokenId) {
  const contract = await getContract();
  const tokenURI = await contract.tokenURI(tokenId);
  if (!tokenURI || tokenURI === "") throw new Error("Invalid token URI");

  // Fetch metadata and current owner in parallel
  const [metadata, currentOwner] = await Promise.all([
    fetchMetadata(tokenURI),
    contract.ownerOf(tokenId),
  ]);
  if (!metadata) throw new Error("Failed to fetch metadata");

  return {
    tokenId,
    currentOwner,
    ...metadata,
  };
}

/**
 * This is the method to retrieve and parse metadata from a given token URI
 * @param {string} uri
 * @returns
 */
export async function fetchMetadata(uri) {
  if (uri.startsWith("ipfs://")) {
    uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }

  if (uri.startsWith("ar://")) {
    uri = uri.replace("ar://", "https://arweave.net/");
  }

  const metadata = await fetch(uri)
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch metadata");
      return res.json();
    })
    .catch((_error) => {
      return null;
    });

  if (!metadata) return null;

  const imageUrl = metadata?.image ?? metadata.Image;

  return {
    name: metadata.name ?? metadata.Name ?? "Unknown",
    description:
      metadata.description ?? metadata.Description ?? "No description",
    image: imageUrl
      ? imageUrl
          .replace("ipfs://", "https://ipfs.io/ipfs/")
          .replace("ar://", "https://arweave.net/")
      : null,
    attributes: metadata.attributes ?? metadata.Attributes ?? [],
  };
}
