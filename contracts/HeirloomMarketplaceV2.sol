// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./HeirloomMarketplace.sol";

/**
    @title heirloomdao nft marketplace contract
*/
contract HeirloomMarketplaceV2 is HeirloomMarketplace  {
    
    address public nftContractAddress;
    address public _licenseProvider;
    address public ref;
    uint256 public _start;
    uint256 public _end; 
    uint256 public _price; 
    uint96 public _rbp; 

    event MaxSupply (uint256 indexed maxSupply);
    
    function createSale(address nftContract, uint256 maxSupply, address licenseProvider, address refferer, uint256 start, uint256 end, uint256 price, uint96 rbp) public override virtual onlyRole(ADMIN_ROLE) {
        nftContractAddress = nftContract;
        _licenseProvider = licenseProvider;
        ref = refferer;
        _start = start;
        _end = end;
        _price = price;
        _rbp = rbp;
        emit MaxSupply(maxSupply);
    }

    function verifyUser(address user) external override virtual onlyRole(ADMIN_ROLE) {
        _isVerified[user] = true;
        emit UserVerified(user);
    }
}  