// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
contract MederuLineage is ERC721URIStorage {
    struct Artwork { uint256 parentId; uint256 generation; string aiTitle; string aiInterpretation; address creator; uint256 createdAt; }
    mapping(uint256 => Artwork) public artworks;
    mapping(uint256 => uint256[]) private _children;
    uint256 private _nextId = 1;
    event ArtworkMinted(uint256 indexed tokenId, uint256 indexed parentId, uint256 generation, address creator);
    constructor() ERC721("Mederu Lineage", "MEDERU") {}
    function mintGenesis(string memory uri, string memory title, string memory interpretation) external returns (uint256) {
        uint256 id = _nextId++;
        _safeMint(msg.sender, id); _setTokenURI(id, uri);
        artworks[id] = Artwork(0, 0, title, interpretation, msg.sender, block.timestamp);
        emit ArtworkMinted(id, 0, 0, msg.sender); return id;
    }
    function mintReinterpretation(uint256 parentId, string memory uri, string memory title, string memory interpretation) external returns (uint256) {
        require(_ownerOf(parentId) != address(0), "Parent does not exist");
        uint256 id = _nextId++; uint256 gen = artworks[parentId].generation + 1;
        _safeMint(msg.sender, id); _setTokenURI(id, uri);
        artworks[id] = Artwork(parentId, gen, title, interpretation, msg.sender, block.timestamp);
        _children[parentId].push(id);
        emit ArtworkMinted(id, parentId, gen, msg.sender); return id;
    }
    function getChildren(uint256 parentId) external view returns (uint256[] memory) { return _children[parentId]; }
    function totalMinted() external view returns (uint256) { return _nextId - 1; }
}
