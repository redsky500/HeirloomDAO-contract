// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import '@openzeppelin/contracts/access/AccessControl.sol';
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import '../Types.sol';
import './Constants.sol';

/**
* @title HeirloomDAO Marketplace Escrow 
* @dev Contract for the heirloom dao marketplace that handles pull payments to license providers.
*/

contract HeirloomEscrow is Types, 
Context, 
Pausable, 
AccessControl, 
Constants, 
ReentrancyGuard {

    using SafeERC20 for IERC20;
    using Address for address payable;
    
    struct Account {
        address main;
        uint256 erc20Balance;
        uint256 nativeBalance; 
    }

    event ERC20Deposited(address indexed payee, uint256 indexed weiAmount); 
    event Deposited(address indexed payee, uint256 indexed weiAmount); 
    event Withdrawn(address indexed payee, uint256 indexed weiAmount);
    event AccountCreated(address indexed licenseProvider, address indexed representative);
    
    mapping(address => Account) private _deposits;
    mapping(address => bool) private _isDepositor;
    
    address private _hiloToken;
    
    modifier onlyDepositor(){
        require(_isDepositor[_msgSender()] == true, "HeirloomDAO Escrow: caller not depositor");
        _;
    }

    modifier onlyNewAccount(address representative){
        require(_deposits[representative].main == address(0) , "HeirloomDAO Escrow: account already exists");
        _;
    }

    constructor(address heirloomToken, address operator){
        _grantRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(PAUSER_ROLE, _msgSender());
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
        _grantRole(ESCROW_ROLE, operator);
        _setRoleAdmin(ESCROW_ROLE, ADMIN_ROLE);
        _hiloToken = heirloomToken;
    }
    
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    function erc20DepositsOf() public view onlyDepositor returns (uint256) {
        return _deposits[_msgSender()].erc20Balance;
    }

    function nativeDepositsOf() public view onlyDepositor returns (uint256) {
        return _deposits[_msgSender()].nativeBalance;
    }

    function withdrawERC20() public nonReentrant onlyDepositor whenNotPaused {
        require(_deposits[_msgSender()].erc20Balance > 0, "Heirloom Escrow: insufficient balance");
        uint256 amount = _deposits[_msgSender()].erc20Balance;
        _deposits[_msgSender()].erc20Balance = 0;
        IERC20(_hiloToken).safeTransfer(_deposits[_msgSender()].main, amount);
        emit Withdrawn(_deposits[_msgSender()].main, amount); 
    }

    function withdrawNative() external nonReentrant onlyDepositor whenNotPaused {
        require(_deposits[_msgSender()].nativeBalance > 0, "Heirloom Escrow: insufficient balance");
        uint256 amount = _deposits[_msgSender()].nativeBalance;
        _deposits[_msgSender()].nativeBalance = 0;
        payable(_deposits[_msgSender()].main).sendValue(amount);
        emit Withdrawn(_deposits[_msgSender()].main, amount);
    }

    function createAccount(address licenseProvider, address representative)
    external
    onlyNewAccount(representative) 
    onlyRole(ESCROW_ROLE) {

        Account memory newAccount = Account({
            main: licenseProvider,
            erc20Balance: 0,
            nativeBalance: 0 
        });
        _deposits[representative] = newAccount;
        _isDepositor[representative] = true;
        emit AccountCreated(licenseProvider, representative);
    }

    function depositERC20(address payee, uint256 amount) external onlyRole(ESCROW_ROLE) whenNotPaused {
        _deposits[payee].erc20Balance += amount;
        emit ERC20Deposited(payee, amount);
    }

    function depositNative(address payee) external payable onlyRole(ESCROW_ROLE) whenNotPaused {
        _deposits[payee].nativeBalance += msg.value;
        emit Deposited(payee, msg.value);
    }
    
    function accountExists(address representative) external view onlyRole(ESCROW_ROLE) returns (bool) {
        return _deposits[representative].main == address(0) ? false : true;
    }
    function getToken() view external onlyRole(ADMIN_ROLE) returns (address hilo){
        hilo = _hiloToken;
    }

    function updateToken(address newToken) external onlyRole(ADMIN_ROLE) whenPaused {
        _hiloToken = newToken;
        emit TokenUpdated(newToken);
    }
}