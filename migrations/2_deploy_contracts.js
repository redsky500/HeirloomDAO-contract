require('dotenv').config();
const { deployProxy } = require('@openzeppelin/truffle-upgrades');
const HeirloomMarketplace = artifacts.require("HeirloomMarketplace");
const HeirloomLicenseNFT = artifacts.require("HeirloomLicenseNFT");
const HeirloomToken =  artifacts.require("HeirloomToken");
const HeirloomEscrow = artifacts.require("HeirloomEscrow");
const { roles } = require('../test/roles');


module.exports = async (deployer, networks, accounts) => {
    const uri = "http://localhost:3001/licenses/metadata/"; 
    const admin = accounts[0];
    const verifier = networks === 'development' || networks === 'develop' ? accounts[1] : admin;
    const treasury = networks === 'development' || networks === 'develop' ? accounts[1] : process.env.TREASURY;
    const LISTING_FEE = web3.utils.toWei("0.1", "ether");
    const COMMISSION_BP = 2000;
    
    // first token
    const supply = new web3.utils.BN(web3.utils.toWei('10000000', 'ether'));
    await deployer.deploy(HeirloomToken, treasury, supply, {from: admin});
    const token = await HeirloomToken.deployed();
    
    // then escrow 
    await deployer.deploy(HeirloomEscrow, token.address, admin, { from: admin }); 
    const escrowSales = await HeirloomEscrow.deployed();
    await deployer.deploy(HeirloomEscrow, token.address, admin, { from: admin }); 
    const escrowListed = await HeirloomEscrow.deployed();
    
    // then marketplace
    const marketplaceProxy = await deployProxy(HeirloomMarketplace, [admin, verifier, LISTING_FEE, token.address, treasury, escrowSales.address, escrowListed.address, COMMISSION_BP], {initializer: '__HeirloomMarketplace_init', kind: 'uups', unsafeAllow: ['constructor', 'delegatecall'] });

    // const salesAddress = "0xA7f755e5A4324bDB64ab7903e0AC6230D382DDD9"
    // const listedAddress = "0xdE6816B3A64F4a516536EC582e67a38B89Acfcca"
    // const tokenAddress = "0xA9A35A20149F77C70686D15D7f2254A0Bdc8505A"
    // const marketplaceProxy = await deployProxy(HeirloomMarketplace, [admin, verifier, LISTING_FEE, tokenAddress, treasury, salesAddress, listedAddress, COMMISSION_BP], {initializer: '__HeirloomMarketplace_init', kind: 'uups', unsafeAllow: ['constructor', 'delegatecall'] });

    // // set market to have escrow role
    // const token = new web3.eth.Contract(HeirloomToken.abi, tokenAddress)
    // const escrowSales = new web3.eth.Contract(HeirloomEscrow.abi, salesAddress);
    // const escrowListed = new web3.eth.Contract(HeirloomEscrow.abi, listedAddress);
    // await escrowSales.methods.revokeRole(roles.Escrow, admin).send({from: admin});
    // await escrowSales.methods.grantRole(roles.Escrow, marketplaceProxy.address).send({from: admin});
    // await escrowListed.methods.revokeRole(roles.Escrow, admin).send({from: admin});
    // await escrowListed.methods.grantRole(roles.Escrow, marketplaceProxy.address).send({from: admin});

    // set market to have escrow role
    await escrowSales.revokeRole(roles.Escrow, admin, {from: admin});
    await escrowSales.grantRole(roles.Escrow, marketplaceProxy.address, {from: admin});
    await escrowListed.revokeRole(roles.Escrow, admin, {from: admin});
    await escrowListed.grantRole(roles.Escrow, marketplaceProxy.address, {from: admin});
    
    // then erc1155
    await deployer.deploy(HeirloomLicenseNFT, uri, marketplaceProxy.address, admin, {from: admin});
    const nft = await HeirloomLicenseNFT.deployed();

    

    console.log(`contracts successfully deployed to: ${networks}`);
    console.log(`address escrow for sales: ${escrowSales.address}`);
    console.log(`address escrow for listed licenses: ${escrowListed.address}`);
    console.log(`address marketplace proxy: ${marketplaceProxy.address}`);
    console.log(`address nft: ${nft.address}`);
    console.log(`address token: ${token.address}`);
}