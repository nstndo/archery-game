// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract ArcheryRecords is ERC721URIStorage {
    uint public tokenCounter;

    struct Record {
        address player;
        uint score;
    }

    mapping(uint => Record) public records;

    constructor() ERC721("ArcheryRecord", "ARCD") {}

    function mintRecord(address to, uint score, string memory uri) external {
        uint tokenId = tokenCounter++;
        records[tokenId] = Record(to, score);
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }
}
