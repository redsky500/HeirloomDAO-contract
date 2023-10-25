// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../libs/LibPart.sol";

interface IHeirloomRoyaltiesV1 {
    event RoyaltiesSet(uint256 tokenId, LibPart.Part[] royalties);
    function getHeirloomV1Royalties(uint256 id) external view returns (LibPart.Part[] memory);
}
