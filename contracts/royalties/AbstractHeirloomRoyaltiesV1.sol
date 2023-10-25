// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../libs/LibPart.sol";

abstract contract AbstractHeirloomRoyaltiesV1 {
    mapping (uint256 => LibPart.Part[]) internal royalties;

    function _saveRoyalties(uint256 id, LibPart.Part[] memory _royalties) internal {
        uint256 totalValue;
        for (uint i = 0; i < _royalties.length; i++) {
            require(_royalties[i].licenseProvider != address(0x0), "Heirloom Royalties: Recipient should be present");
            require(_royalties[i].value != 0, "Heirloom Royalties: Royalty value should be positive");
            totalValue += _royalties[i].value;
            royalties[id].push(_royalties[i]);
        }
        require(totalValue <= 1000, "Heirloom Royalties: Royalty total value should be <= 1000");
        _onRoyaltiesSet(id, _royalties);
    }

    function _updateAccount(uint256 _id, address _from, address _to) internal {
        uint length = royalties[_id].length;
        for(uint i = 0; i < length; i++) {
            if (royalties[_id][i].licenseProvider == _from) {
                royalties[_id][i].licenseProvider = payable(address(_to));
            }
        }
    }

    function _onRoyaltiesSet(uint256 id, LibPart.Part[] memory _royalties) virtual internal;
}
