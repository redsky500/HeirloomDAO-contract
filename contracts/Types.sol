// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

/**
    @title contains the data structures utilized in the heirloom marketplace;
*/

abstract contract Types {
    
    /**
      @notice represents status of listed license
    */
    enum ListedStatus { Open, Closed }
    

    /**
        @notice represents a sale item object
        @dev The first time the sale Item is redeemed minted becomes true
        @dev The total balance of the token can never exceed the total suppy of the token 
    */
    struct SaleItem {
        uint256 saleId;
        address licenseProvider;
        address representative;
        uint256 tokenId;
        address nftContract;
        address refferer;
        uint256 soldLicenses;
        uint256 maxSupply;
        uint256 start;
        uint256 end;
        uint256 price;
        bool active;
        bool isFuture;
    }

    /**
        @notice represents a LicenseItem
    **/
    struct LicenseItem {
        uint256 tokenId;
        uint256 licenseId;
        address nftContract;
        address seller;
        uint256 price;
        uint256 listedAmount;
        uint256 sold;
        ListedStatus status; 
    }
    
    /**
        @notice emitted after every sale created
        @param representative license provider
        @param saleId id of the current ongoing sale
        @param tokenId tokenId of the license in the sale
    **/
    event SaleCreated(address indexed representative, uint256 indexed saleId, uint256 indexed tokenId);

    /**
        @notice emitted after a close sale
        @param saleId id of the current ongoing sale
    **/
    event SaleClosed(uint256 indexed saleId);

    /**
        @notice emitted after a (future) sale is activated
        @param saleId id of the current ongoing sale
    **/
    event SaleActivated(uint256 indexed saleId);

    /**
        @notice emitted after a license is bought from a sale
        @param saleId id of the current ongoing sale
        @param tokenId token id of the license to be sold
    **/
    event BoughtFromSale(uint256 indexed saleId, uint256 indexed tokenId, address buyer, uint256 amount);
    
    
    /**
        @notice emitted after a license is listed by a user
        @param licenseId id of the current ongoing license
        @param tokenId token id of the license to be sold
        @param seller address of the lister
        @param price matic price of the listed license id
        @param listedAmount amount licences listed
    **/
    event LicenseListed(
        uint256 indexed licenseId,
        uint256 indexed tokenId,
        address seller,
        uint256 price,
        uint256 indexed listedAmount
    );

    /**
        @notice emitted after a license is listed by a user
        @param licenseId id of the current ongoing license
        @param tokenId token id of the license to be sold
        @param seller address of the lister
        @param buyer adress of buyer
        @param amount amount licences listed
        @param price matic price of the listed license id
    **/
    event LicenseSold (
        uint256 licenseId,
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 amount,
        uint256 price
    );

    /**
        @notice emitted after a listed license is closed
        @param licenseId id of the current ongoing license
        @param tokenId token id of the closed listed license
        @param seller address of the lister
        @param status matic price of the listed license id
    **/
    event ListedLicenseClosed(
        uint256 indexed licenseId, 
        uint256 indexed tokenId, 
        address indexed seller, 
        ListedStatus status
    );

    /**
        @notice emitted after the treasury is updated 
        @param newTreasury address to which the treasury is updated to
    **/
    event TreasuryUpdated(address indexed newTreasury);

    /**
        @notice emitted after the treasury is updated 
        @param newEscrow address to which escrow is updated to
    **/
    event EscrowUpdated(address indexed newEscrow);
    
    /**
        @notice emitted after the treasury is updated 
        @param newToken address to which escrow is updated to
    **/
    event TokenUpdated(address indexed newToken);

    /**
        @notice emitted after the treasury is updated 
        @param user address to which escrow is updated to
    **/
    event UserVerified(address indexed user);
    
    /**
        @notice emitted after the listing fee is updated 
        @param listingFee new listing fee
    **/
    event ListingFeeUpdated(uint256 indexed listingFee);
    
    /**
        @notice emitted after the commission basis points is updated 
        @param Commission new commission basis points
    **/
    event CommissionUpdated(uint96 indexed Commission);
} 