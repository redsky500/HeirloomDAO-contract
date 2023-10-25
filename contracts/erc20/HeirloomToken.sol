// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import '../utils/Constants.sol';

contract HeirloomToken is ERC20, ERC20Burnable, ERC20Snapshot, AccessControl, Pausable, Constants {

    constructor(address treasury, uint256 supply) ERC20("HeirloomToken", "HILO") {
        _grantRole(ADMIN_ROLE, msg.sender);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(SNAPSHOT_ROLE, msg.sender);
        _setRoleAdmin(SNAPSHOT_ROLE, ADMIN_ROLE);
        _grantRole(PAUSER_ROLE, msg.sender);
        _setRoleAdmin(PAUSER_ROLE, ADMIN_ROLE);
        _mint(treasury, supply * 10 ** decimals());
        _grantRole(MINTER_ROLE, msg.sender);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
    }

    function snapshot() public onlyRole(SNAPSHOT_ROLE) {
        _snapshot();
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        override(ERC20, ERC20Snapshot)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
