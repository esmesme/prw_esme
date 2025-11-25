// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";

contract EsmeMadeThis is ERC721URIStorage, ERC2981, Ownable {
    uint256 public nextTokenId;

    constructor(address royaltyReceiver, address initialOwner) ERC721("Esme Made This", "ESME") Ownable(initialOwner) 
    {
        // Set 5% royalties (500 basis points)
        _setDefaultRoyalty(royaltyReceiver, 500);
        
    }

    function mintTo(address recipient, string memory uri) external onlyOwner {
        uint256 tokenId = ++nextTokenId;
        require(bytes(uri).length > 0, "URI cannot be empty");
        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);
        
    }

    function setRoyaltyInfo(address receiver, uint96 feeBasisPoints) external onlyOwner {
    _setDefaultRoyalty(receiver, feeBasisPoints);
    emit RoyaltyChanged(receiver, feeBasisPoints);
}
    event RoyaltyChanged(address indexed receiver, uint96 feeBasisPoints);
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
