// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./AbstractHeirloomRoyaltiesV1.sol";
import "../interfaces/IHeirloomRoyaltiesV1.sol";

contract HeirloomRoyaltiesV1 is AbstractHeirloomRoyaltiesV1, IHeirloomRoyaltiesV1 {

    function getHeirloomV1Royalties(uint256 id) override external view returns (LibPart.Part[] memory) {
        return royalties[id];
    }

    function _onRoyaltiesSet(uint256 id, LibPart.Part[] memory _royalties) override internal {
        emit RoyaltiesSet(id, _royalties);
    }
}
