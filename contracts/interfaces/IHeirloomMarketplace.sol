// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";


import "../utils/Constants.sol";
import "../HeirloomStorage.sol";
import "../erc1155/HeirloomLicenseNFT.sol";
import "../utils/HeirloomEscrow.sol";
import "../libs/LibPart.sol";

/**
  @title base contract for heirloomdao marketplace implementation
*/

abstract contract IHeirloomMarketplace is 
HeirloomStorage,
Constants,
Initializable, 
AccessControlUpgradeable,
PausableUpgradeable,
UUPSUpgradeable {

  using Address for address;
  using SafeERC20 for IERC20;
  using Counters for Counters.Counter;

  modifier onlyActive(uint256 saleId){
      require(_idToSaleItem[saleId].active == true && _idToSaleItem[saleId].isFuture == false, "Heirloom Marketplace: inactive sale");
      require(block.timestamp < _idToSaleItem[saleId].end, "Heirloom Marketplace: inactive sale");
      _;
  }

  modifier onlyFutureSale(uint256 saleId){
      require(_idToSaleItem[saleId].isFuture == true, "Heirloom Marketplace: must be future sale");
      require(block.timestamp >= _idToSaleItem[saleId].start, "Heirloom Marketplace: start date not reached yet");
      _;
  }

  modifier onlyPassedDeadline(uint256 saleId){
      require(block.timestamp >= _idToSaleItem[saleId].end, "Heirloom Marketplace: active sale");
      _;
  }

  modifier onlyRepresentative(uint256 saleId){
      require(_idToSaleItem[saleId].representative == _msgSender(), "Heirloom Marketplace: caller is not license provider"); 
      _;
  }
  
  modifier onlyCorrectAmount(uint256 toPay){
      require(msg.value >= toPay, "Heirloom Marketplace: Incorrect payment amount");
      _;
  }

  modifier onlyVerified {
      require(_isVerified[_msgSender()] == true, "Heirloom Marketplace: Unverified caller");
      _;
  }

  function pause() public onlyRole(PAUSER_ROLE) {
      _pause();
  }

  function unpause() public onlyRole(PAUSER_ROLE) {
      _unpause();
  }

  /**
    @notice sets new commission rbp
    @param newBP new commission basis points
  */
  function setCommissionRBP(uint96 newBP) external onlyRole(ADMIN_ROLE) whenPaused {
    COMMISSION_BP = newBP;
    emit CommissionUpdated(newBP);
  }

  /**
    @notice sets the listing fee
    @param newListingFee new listing fee
  */  
  function setListingFee(uint256 newListingFee) external onlyRole(ADMIN_ROLE) whenPaused {
      LISTING_FEE = newListingFee;
      emit ListingFeeUpdated(newListingFee);
  }

  /**
    @notice sets a new treasury address
    @param newTreasury address to which treasury is updated
  */
  function updateTreasury(address newTreasury) external onlyRole(ADMIN_ROLE) whenPaused returns (address) {
      _treasury = newTreasury;
      emit TreasuryUpdated(newTreasury);
      return newTreasury;
  }

  /**
    @notice sets a new escrow address
    @param newEscrow address to which escrow is updated
  */
  function updateEscrowSales(address newEscrow) external onlyRole(ADMIN_ROLE) whenPaused returns (address){
      _escrowSales = newEscrow;
      emit EscrowUpdated(newEscrow);
      return newEscrow;
  }
  
  /**
    @notice sets a new escrow address
    @param newEscrow address to which escrow is updated
  */
  function updateEscrowListed(address newEscrow) external onlyRole(ADMIN_ROLE) whenPaused returns (address){
      _escrowListed = newEscrow;
      emit EscrowUpdated(newEscrow);
      return newEscrow;
  }

  /**
    @notice verifies a user
    @param user verifies a user on request of verifier
  */
  function verifyUser(address user) external virtual onlyRole(VERIFIER_ROLE) {
    _isVerified[user] = true;
    emit UserVerified(user);
  }

  /**
    @notice verifies a user
    @param user checks wheter a user is verified
  */
  function isUserVerified(address user) external view virtual returns (bool) {
    return _isVerified[user];
  }

  /** 
    @notice creates a saleItem
    @param nftContract nft contract for minting license nft
    @param maxSupply token cap of license
    @param refferer address of the refferer
    @param start startDate of the sale
    @param end enddate of sale
    @param price of the item in the sale
    @param rbp royalty basis points, percentage of royalty to be collected by license creator
  */
  function createSale(
    address nftContract,
    uint256 maxSupply,
    address licenseProvider,
    address refferer,
    uint256 start,
    uint256 end,
    uint256 price,
    uint96 rbp
  ) public virtual;

  /**
    @notice activates a sale that starts of which its start date is < block timestamp
    @param saleId id of the sale to be activated
  */
  function activateFutureSale(uint256 saleId) external onlyFutureSale(saleId) onlyRole(ADMIN_ROLE) {
    _idToSaleItem[saleId].active = true;
    _idToSaleItem[saleId].isFuture = false;
    _futureSales.decrement();
    emit SaleActivated(saleId);
  }


  /**
    @notice gives the heirloom operator permission to sell an token amount on behalf of the user
    @param nftContract nft contract address of the license nft
    @param tokenId the tokenId of the Saas License nft
    @param amount the amount of nfts to be put up for sale
    @param  price to sell license for
  */
  function listLicense(
    address nftContract, 
    uint256 tokenId, 
    uint256 price,
    uint256 amount) public payable virtual;

  /**
    @notice allows creator of a sale to foricibly end a sale
    @param saleId id of the sale to be forced closed
  */
  function forceCloseSale(uint256 saleId) external onlyActive(saleId) onlyRepresentative(saleId) whenNotPaused {
    _idToSaleItem[saleId].active = false;
    _closedSales.increment();
    emit SaleClosed(saleId);
  }

  /**
    @notice closes a sale id only if deadline is passed 
    @param saleId id of the sale to be closed
  */
  function closeSaleOnDeadline(uint256 saleId) external onlyPassedDeadline(saleId) onlyRole(ADMIN_ROLE) {
    _idToSaleItem[saleId].active = false;
    _closedSales.increment();
    HeirloomLicenseNFT heirloomNftInstance = HeirloomLicenseNFT(_idToSaleItem[saleId].nftContract);
    heirloomNftInstance.revokeApprovalForAll(_idToSaleItem[saleId].licenseProvider);
    emit SaleClosed(saleId);
  }

  /**
    @notice allows a user to participate in a license sale
    @dev erc20 transfer needs to be pre-approved
    @param saleId id of the ongoing sale
    @param amount number of licenses to buy
   */
  function participate(uint256 saleId, uint256 amount) external payable virtual;

  /**
    @notice fetches all tokenIds listed for sale
  */
  function fetchListedLicenses() external view returns (LicenseItem [] memory) {
    uint256 toFetch = _licenseItemIds.current() - _closedLicenseItems.current();
    LicenseItem [] memory listedItems = new LicenseItem[](toFetch);
    uint count = 0;
    for(uint i = 0; i < _licenseItemIds.current(); i++){
        if(_idToLicenseItem[i+1].status == ListedStatus.Open){
            listedItems[count] = _idToLicenseItem[i+1];
            count++; 
        }
    }
    return listedItems;
  }

  /**
    @notice fetches a license with a given licenseid
    @param licenseId id of the listed license
  */
  function fetchLicense(uint256 licenseId) public view returns (LicenseItem memory) {
    return _idToLicenseItem[licenseId];
  }

  /**
    @notice fetches all of the active nft license sales on the platform
  */
  function fetchActiveSales() external view returns (SaleItem [] memory) {
    uint256 toFetch = _saleIds.current() - _closedSales.current() - _futureSales.current();
    SaleItem [] memory activeSales = new SaleItem[](toFetch);
    uint count = 0; 
    for(uint i = 0; i < _saleIds.current(); i++){
        if(_idToSaleItem[i+1].active == true){
            activeSales[count] = _idToSaleItem[i+1];
            count++; 
        }
    }
    return activeSales;
  }

  /**
    @notice retrieves a sale
    @param saleId id of the sale to be retrieved
  */
  function fetchSale(uint256 saleId) public view returns (SaleItem memory) {
      return _idToSaleItem[saleId];
  }

  /**
    @notice transfers license item to send on tokenTransfer
    @param licenseId id of the license to sell
    @param amount amount to purchase 
  */
  function purchaseLicense(uint256 licenseId, uint256 amount) external payable virtual;
  
  /**
    @notice checks if license is active based on start and block.timestamp
    @param start start time of license
  */
  function isActive(uint256 start) internal view returns (bool) {
    return start > block.timestamp ? false : true;
  }

  /**
    @notice checks if license is in the future based on start and block.timestamp
    @param start start time of license
  */
  function isFuture(uint256 start) internal view returns (bool) {
    return start > block.timestamp ? true : false;
  }
  
  function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) whenPaused {}

  function __HeirloomMarketplace_init (
      address admin,
      address verifier,
      uint256 listingFee,
      address hilo, 
      address treasury, 
      address escrowSales,
      address escrowListed,
      uint96 commissionBp
    ) public initializer {
      __AccessControl_init();
      __Pausable_init();
      _grantRole(ADMIN_ROLE, admin);
      _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
      _grantRole(PAUSER_ROLE, admin);
      _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
      _grantRole(VERIFIER_ROLE, verifier);
      _setRoleAdmin(VERIFIER_ROLE, ADMIN_ROLE);
      LISTING_FEE = listingFee;
      COMMISSION_BP = commissionBp;
      _hiloToken = hilo;
      _escrowSales = escrowSales;
      _escrowListed = escrowListed;
      _treasury = treasury;
  }
}
