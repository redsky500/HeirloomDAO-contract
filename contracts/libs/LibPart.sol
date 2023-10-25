// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

library LibPart {
    bytes32 public constant TYPE_HASH = keccak256("Part(address account,uint96 value)");

    struct Part {
        address payable representative;
        address payable licenseProvider;
        uint96 value;
    }

    function hash(Part memory part) internal pure returns (bytes32) {
        return keccak256(abi.encode(TYPE_HASH, part.representative, part.licenseProvider, part.value));
    }
}