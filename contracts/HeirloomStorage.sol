// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./Types.sol"; 

abstract contract HeirloomStorage is Types {
    
    uint256 public LISTING_FEE;
    uint96 public COMMISSION_BP;
    
    address internal _hiloToken;
    address internal _escrowSales;
    address internal _escrowListed;
    address internal _treasury;

    Counters.Counter internal _saleIds;
    Counters.Counter internal _closedSales;
    Counters.Counter internal _licenseItemIds;
    Counters.Counter internal _closedLicenseItems;
    Counters.Counter internal _futureSales;

    mapping(address => bool) internal _isVerified;
    mapping(uint256 => SaleItem) internal _idToSaleItem;
    mapping(uint256 => LicenseItem) internal _idToLicenseItem;
}