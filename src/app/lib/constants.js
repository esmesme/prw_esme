export const BASE_RPC_ENDPOINTS = [
  "https://1rpc.io/base",
  "https://base.drpc.org",
  "https://base.publicnode.com",
];
export const MAINNET_RPC_ENDPOINTS = [
  "https://eth.llamarpc.com",
  "https://rpc.ankr.com/eth",
  "https://ethereum.publicnode.com",
];
export const CONTRACT_ADDRESS = "0x54d100dbe2c23f332a90538b637b1f9df49cdcda";

export const ERC721_ABI = [
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
