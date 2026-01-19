// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

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
        // -------------------------

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin meet" viewBox="0 0 350 350"><style>.base { fill: #0052FF; font-family: sans-serif; }.text { fill: white; font-weight: bold; }</style><rect width="100%" height="100%" fill="#000010" /><circle cx="175" cy="175" r="100" class="base" /><text x="50%" y="50%" class="text" dominant-baseline="middle" text-anchor="middle" font-size="80">',
            Strings.toString(level),
            '</text><text x="50%" y="85%" class="text" dominant-baseline="middle" text-anchor="middle" font-size="20">BASE ARCHERY</text></svg>'
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
            // Новый игрок
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