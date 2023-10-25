// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

import "./interfaces/IHeirloomMarketplace.sol";
import "./erc1155/HeirloomLicenseNFT.sol";

/**
    @title heirloomdao nft marketplace contract
*/
contract HeirloomMarketplace is IHeirloomMarketplace {
    
    using Address for address;
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;
    
    function createSale(
        address nftContract,
        uint256 maxSupply,
        address licenseProvider,
        address refferer,
        uint256 start,
        uint256 end,
        uint256 price,
        uint96 rbp
    ) public override virtual onlyVerified whenNotPaused {
        require(end > start, "Heirloom Marketplace: Incorrect end dates");

        _saleIds.increment();
        uint256 tokenId = HeirloomLicenseNFT(nftContract).createLicense(licenseProvider, _msgSender(), maxSupply, rbp);

        if(isFuture(start)) {
            _futureSales.increment();
        }

        SaleItem memory saleItem = SaleItem({
            saleId: _saleIds.current(),
            licenseProvider: licenseProvider,
            representative: _msgSender(),
            tokenId: tokenId,
            nftContract: nftContract,
            refferer: refferer,
            soldLicenses: 0,
            maxSupply: maxSupply,
            start: start,
            end: end,
            price: price,
            active: isActive(start),
            isFuture: isFuture(start)
        });
        _idToSaleItem[saleItem.saleId] = saleItem;
        
        if (!HeirloomEscrow(_escrowSales).accountExists(_msgSender())) {
            HeirloomEscrow(_escrowSales).createAccount(licenseProvider, _msgSender());
        }
        emit SaleCreated(_msgSender(), saleItem.saleId, tokenId);
    }

    function listLicense(
        address nftContract, 
        uint256 tokenId, 
        uint256 price,
        uint256 amount)
    public payable override virtual
    onlyCorrectAmount(LISTING_FEE) 
    whenNotPaused {
        require(HeirloomLicenseNFT(nftContract).isApprovedForAll(_msgSender(), address(this)), "Heirloom Marketplace: market operator not approved for this listing");
        require(HeirloomLicenseNFT(nftContract).balanceOf(_msgSender(), tokenId) >= amount, "Heirloom Marketplace: insufficient 'nft' balance");
        
        _licenseItemIds.increment();
        uint256 licenseId = _licenseItemIds.current();
        LicenseItem memory licenseItem = LicenseItem({
            licenseId: licenseId,
            tokenId: tokenId,
            nftContract: nftContract,
            seller: _msgSender(),
            price: price,
            listedAmount: amount,
            sold: 0,
            status: ListedStatus.Open
        });
        
        _idToLicenseItem[licenseId] = licenseItem;
        Address.sendValue(payable(_treasury), LISTING_FEE);

        if (!HeirloomEscrow(_escrowListed).accountExists(_msgSender())) {
            HeirloomEscrow(_escrowListed).createAccount(_msgSender(), _msgSender());
        }

        emit LicenseListed(licenseId, tokenId, _msgSender(), price, amount);
    }

    function participate(uint256 saleId, uint256 amount) 
    public payable override
    onlyCorrectAmount(amount * _idToSaleItem[saleId].price) 
    onlyActive(saleId)  
    whenNotPaused {
        require(_idToSaleItem[saleId].soldLicenses + amount <= _idToSaleItem[saleId].maxSupply, "Heirloom Marketplace: amount cannot supercede max supply");
        
        _idToSaleItem[saleId].soldLicenses += amount;
        IERC1155 nftInstance = IERC1155(_idToSaleItem[saleId].nftContract);
        uint256 toPay = amount * _idToSaleItem[saleId].price;
        uint256 commission = (COMMISSION_BP * toPay) / 10000;
        
        HeirloomEscrow(_escrowSales).depositNative{value: toPay - commission}(_idToSaleItem[saleId].representative);
        Address.sendValue(payable(_treasury), commission);
        nftInstance.safeTransferFrom(_idToSaleItem[saleId].licenseProvider, _msgSender(), _idToSaleItem[saleId].tokenId, amount, "");
        emit BoughtFromSale(saleId, _idToSaleItem[saleId].tokenId, _msgSender(), amount);

        HeirloomLicenseNFT heirloomNftInstance = HeirloomLicenseNFT(_idToSaleItem[saleId].nftContract);
        if(_idToSaleItem[saleId].soldLicenses == _idToSaleItem[saleId].maxSupply){
            _idToSaleItem[saleId].active = false;
            heirloomNftInstance.revokeApprovalForAll(_idToSaleItem[saleId].licenseProvider);
        }
    }

    function purchaseLicense(uint256 licenseId, uint256 amount) 
    public payable override virtual
    onlyCorrectAmount(amount * _idToLicenseItem[licenseId].price) 
    whenNotPaused {
        require(_idToLicenseItem[licenseId].status == ListedStatus.Open, "Heirloom Marketplace: item is unlisted");
        require(_idToLicenseItem[licenseId].sold + amount <= _idToLicenseItem[licenseId].listedAmount, "Heirloom Marketplace: amount cannot supercede listed amount");

        LicenseItem memory item = _idToLicenseItem[licenseId];
        LibPart.Part[] memory royalties = HeirloomLicenseNFT(item.nftContract).getHeirloomV1Royalties(item.tokenId);
        uint256 toPay = item.price * amount;
        uint256 royaltyFee = (royalties[0].value * toPay) / 10000;
        HeirloomEscrow(_escrowListed).depositNative{value: toPay - royaltyFee}(item.seller);
        HeirloomEscrow(_escrowSales).depositNative{value: royaltyFee}(royalties[0].representative);

        HeirloomLicenseNFT(item.nftContract).safeTransferFrom(item.seller, _msgSender(), item.tokenId, amount, "");
        emit LicenseSold(licenseId, item.tokenId, item.seller, _msgSender(), amount, item.price);
        
        item.sold += amount;
        if(item.sold == item.listedAmount){
            _closedLicenseItems.increment();
            HeirloomLicenseNFT(item.nftContract).revokeApprovalForAll(_idToLicenseItem[licenseId].seller);
            _idToLicenseItem[licenseId].status = ListedStatus.Closed;
            emit ListedLicenseClosed(licenseId, item.tokenId, item.seller, ListedStatus.Closed);
        }
    }
}  