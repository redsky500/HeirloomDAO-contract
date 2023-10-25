// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import '@openzeppelin/contracts/utils/Counters.sol';
import '../utils/Constants.sol';

import '../royalties/HeirloomRoyaltiesV1.sol';
import '../libs/LibPart.sol';
import '../libs/LibHeirloomRoyaltiesV1.sol';


contract HeirloomLicenseNFT is ERC1155,
AccessControl, 
ERC1155Supply,
HeirloomRoyaltiesV1,
Pausable,
Constants {
    
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds; 
    address private _marketOperator;
    event MarketOperatorChanged(address indexed newMarketOperator);

    constructor(string memory baseTokenUri, address operator, address admin) ERC1155(baseTokenUri) {
        _grantRole(MINTER_ROLE, operator);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(OPERATOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _marketOperator = operator;
    }


    function setURI(string memory newuri) public onlyRole(ADMIN_ROLE) {
        _setURI(newuri);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
        @notice creates a saas license
        @param licenseProvider creator of the license subscription
        @param maxSupply the max supply of the license 
    */
    function createLicense(address licenseProvider, address representative, uint256 maxSupply, uint96 rbp) public
    onlyRole(MINTER_ROLE) whenNotPaused returns (uint256){
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        _setRoyalties(tokenId, licenseProvider, representative, rbp);
        _setApprovalForAll(licenseProvider, _marketOperator, true);
        _mint(licenseProvider, tokenId, maxSupply, "");
        return tokenId;
    }

    function revokeApprovalForAll(address account) external onlyRole(OPERATOR_ROLE) {
        _setApprovalForAll(account, _marketOperator, false);
    }

    function getMarketOperator() external view onlyRole(ADMIN_ROLE) returns (address) {
        return _marketOperator;
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
        internal
        override(ERC1155, ERC1155Supply)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        if(interfaceId == LibHeirloomRoyaltiesV1._INTERFACE_ID_ROYALTIES){
            return true;
        }
        return super.supportsInterface(interfaceId);
    }

    function _setRoyalties(uint256 tokenId, address licenseProvider, address representative, uint96 rbp) private {
        LibPart.Part[] memory _royalties = new LibPart.Part[](1);
        _royalties[0].value = rbp;
        _royalties[0].licenseProvider = payable(licenseProvider);
        _royalties[0].representative = payable(representative);
        _saveRoyalties(tokenId, _royalties);
    }
    
}
