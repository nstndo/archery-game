// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract ArcheryScore is ERC721URIStorage {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    struct PlayerStats {
        address wallet;
        uint256 maxLevel;
        uint256 tokenId;
    }

    PlayerStats[] public leaderboard;
    mapping(address => uint256) private playerIndex;

    constructor() ERC721("Base Archery Score", "ARCHERY") {}

    function mintScore(uint256 level) public returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();

        _mint(msg.sender, newItemId);
        updateLeaderboard(msg.sender, level, newItemId);

        string memory svg = string(abi.encodePacked(
            '<svg width="500" height="500" viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">',
            '<defs>',
                '<clipPath id="rounded"><rect x="0" y="0" width="100%" height="100%" rx="35" ry="35" /></clipPath>',
                '<mask id="arrow-cutout"><rect width="360" height="360" fill="white"/><path d="M0 175 H160 V167 L179 179 L160 191 V183 H0 V175Z" fill="black"/></mask>',
            '</defs>',
            '<g clip-path="url(#rounded)">',
                '<rect width="500" height="500" fill="#0052FF"/>',
                '<circle cx="178.915" cy="179.095" r="100" fill="white" mask="url(#arrow-cutout)"/>',
                '<style>.level-num { fill: white; font-family: sans-serif; font-size: 50px; font-weight: bold; } .brand { fill: white; font-family: sans-serif; font-weight: 900; font-size: 24px; letter-spacing: 2px; }</style>',
                '<text x="50%" y="12%" class="level-num" dominant-baseline="middle" text-anchor="middle">', Strings.toString(level), '</text>',
                '<text x="50%" y="90%" class="brand" dominant-baseline="middle" text-anchor="middle">BASE ARCHERY</text>',
            '</g>',
            '</svg>'
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "Archery Level ', Strings.toString(level), '",',
            '"description": "High score record in Base Archery Game",',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes": [{"trait_type": "Level", "value": ', Strings.toString(level), '}]}'
        ))));

        string memory finalTokenUri = string(abi.encodePacked("data:application/json;base64,", json));
        _setTokenURI(newItemId, finalTokenUri);

        return newItemId;
    }

    function updateLeaderboard(address player, uint256 level, uint256 tokenId) internal {
        uint256 idx = playerIndex[player];
        if (idx == 0) {
            leaderboard.push(PlayerStats(player, level, tokenId));
            playerIndex[player] = leaderboard.length;
        } else {
            if (level > leaderboard[idx - 1].maxLevel) {
                leaderboard[idx - 1].maxLevel = level;
                leaderboard[idx - 1].tokenId = tokenId;
            }
        }
    }

    function getLeaderboard() public view returns (PlayerStats[] memory) {
        return leaderboard;
    }
}