// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract ArcheryScore is ERC721 {
    uint256 private _nextTokenId;

    struct PlayerStats {
        address wallet;
        uint256 maxLevel;
        uint256 tokenId;
    }

    PlayerStats[] public leaderboard;
    mapping(address => uint256) private playerIndex;
    
    mapping(uint256 => uint256) public tokenLevels;

    constructor() ERC721("Base Archery Score", "ARCHERY") {
        _nextTokenId = 1;
    }

    function mintScore(uint256 level) public returns (uint256) {
        uint256 newItemId = _nextTokenId++;

        _mint(msg.sender, newItemId);
        
        tokenLevels[newItemId] = level;
        
        updateLeaderboard(msg.sender, level, newItemId);

        return newItemId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        uint256 level = tokenLevels[tokenId];

        string memory svg = string(abi.encodePacked(
            '<svg width="500" height="500" viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">',
            '<defs>',
                '<clipPath id="rounded"><rect x="0" y="0" width="100%" height="100%" rx="30" ry="30" /></clipPath>',
                '<mask id="arrow-cutout-bold"><rect width="360" height="360" fill="white"/><path d="M0 150 L130 150 L130 120 L190 180 L130 240 L130 210 L0 210 Z" fill="black"/></mask>',
            '</defs>',
            '<g clip-path="url(#rounded)">',
                '<rect width="500" height="500" fill="#0000FF"/>',
                '<circle cx="180" cy="180" r="110" fill="white" mask="url(#arrow-cutout-bold)"/>',
                '<style>.level-num { fill: white; font-family: sans-serif; font-size: 50px; font-weight: bold; } .brand { fill: white; font-family: sans-serif; font-weight: 900; font-size: 24px; letter-spacing: 2px; }</style>',
                '<text x="50%" y="12%" class="level-num" dominant-baseline="middle" text-anchor="middle">', 'LVL ', Strings.toString(level), '</text>',
                '<text x="50%" y="90%" class="brand" dominant-baseline="middle" text-anchor="middle">BASE ARCHERY</text>',
            '</g>',
            '</svg>'
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name": "Archery Level ', Strings.toString(level), '",',
            '"description": "High score record in Base Archery Game. Fully on-chain SVG.",',
            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes": [{"trait_type": "Level", "value": ', Strings.toString(level), '}]}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
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