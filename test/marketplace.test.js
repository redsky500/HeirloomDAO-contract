const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const chai = require('chai');
const HeirloomMarketplace = artifacts.require("HeirloomMarketplace.sol");
const HeirloomMarketplaceV2 = artifacts.require("HeirloomMarketplaceV2.sol");
const HeirloomToken = artifacts.require("HeirloomToken.sol");
const HeirloomLicenseNFT = artifacts.require("HeirloomLicenseNFT.sol");
const HeirloomEscrow = artifacts.require("HeirloomEscrow.sol");

const should = chai.should();
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { paymentTypes } = require('./paymenttypes.js');
const { listedStatus } = require('./listedStatus.js');
const { roles } = require('./roles.js');
const {getStartSaleTimestamp} = require('../utils/blocks.js')

contract('HeirloomMarketplace', (accounts) => {
    const uri = "http://localhost:3001/license/metadata/"
    const [admin, treasury, verifier, pauser, alice, bob, carl, ed, david, fred] = accounts;
    const supply = new web3.utils.BN(web3.utils.toWei('10000000', 'ether'));
    const LISTING_FEE = web3.utils.toWei("0.1", "ether");
    const COMMISSION_BP = 2000;
    var marketplace, nft, token, escrowSales, escrowListed;

    beforeEach(async () => {
        token = await HeirloomToken.new(treasury, supply, { from: admin });
        escrowSales = await HeirloomEscrow.new(token.address, admin, { from: admin });
        escrowListed = await HeirloomEscrow.new(token.address, admin, { from: admin });
        
        marketplace = await deployProxy(HeirloomMarketplace, [admin, verifier, LISTING_FEE, token.address, treasury, escrowSales.address, escrowListed.address, COMMISSION_BP], { initializer: '__HeirloomMarketplace_init', kind: 'uups', unsafeAllow: ['constructor', 'delegatecall'] });
        nft = await HeirloomLicenseNFT.new(uri, marketplace.address, admin, { from: admin });

        await escrowSales.revokeRole(roles.Escrow, admin, {from: admin});
        await escrowSales.grantRole(roles.Escrow, marketplace.address, {from: admin});
        await escrowListed.revokeRole(roles.Escrow, admin, {from: admin});
        await escrowListed.grantRole(roles.Escrow, marketplace.address, {from: admin});

    });
    context('Initialization ...', () => {
        it('sets the correct listing fees', async () => {
            let listingFee = await marketplace.LISTING_FEE.call();
            expect(listingFee.toString()).to.equal(LISTING_FEE);
        });
        it('sets the correct roles', async () => {
            const adminIsAdmin = await marketplace.hasRole(roles.Admin, admin);
            const pauserIsPauser = await marketplace.hasRole(roles.Pauser, admin);
            const verifierIsVerifier = await marketplace.hasRole(roles.Verifier, verifier);
            expect(adminIsAdmin).to.be.true;
            expect(pauserIsPauser).to.be.true;
            expect(verifierIsVerifier).to.be.true;
        });
    })
    context('Upgrades ...', () => {
        it('allows initializer to run only once', async () => {
            await expect(marketplace.__HeirloomMarketplace_init(admin, verifier, LISTING_FEE, token.address, treasury, escrowSales.address, escrowListed.address, COMMISSION_BP,  { from: admin })).to.be.rejected;
        });
        it('allows only admin to upgrade contract', async () => {
            await marketplace.pause({from: admin}); 
            await expect(marketplace.upgradeTo(alice, {from: alice})).to.be.rejected;
            let Err; 
            try {
                await upgradeProxy(marketplace.address, HeirloomMarketplaceV2, { kind: 'uups', unsafeAllow: ['delegatecall'] });
            } catch (e) { 
                Err = e;
            }
            expect(Err).to.equal(undefined); // if no err then call from admin succeeded
        });
        it('allows for contract upgrades and retains state after upgrade and allows for change of functions', async () => {
            await marketplace.verifyUser(david, {from: verifier});
            await marketplace.pause({from: admin});
            const upgraded = await upgradeProxy(marketplace.address, HeirloomMarketplaceV2, { kind: 'uups', unsafeAllow: ['delegatecall'] });
            const isDavidVerified = await upgraded.isUserVerified.call(david);
            expect(isDavidVerified).to.be.true;
            const  { logs: [ { args: { maxSupply } } ] } = await upgraded.createSale(
                nft.address,
                500,
                fred, 
                bob,
                new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())),
                new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + (3600 * 24)))),
                new web3.utils.BN(LISTING_FEE),
                900,
                { from: admin }
            );
            expect(maxSupply.toNumber()).to.equal(500);
            const nftAddress = await upgraded.nftContractAddress.call();
            const { logs: [ { args: { user } } ] } = await upgraded.verifyUser(carl, { from: admin });
            expect(user).to.equal(carl);
            expect(nftAddress).to.equal(nft.address);
            const v3 = await upgradeProxy(upgraded.address, HeirloomMarketplaceV2, { kind: 'uups', unsafeAllow: ['delegatecall'] });
            const v3NftAddress = await v3.nftContractAddress.call();
            expect(v3NftAddress).to.equal(nft.address);
        });
    })
    context('Security tests ...', () => {
        it('rejects operations from unassigned roles', async () => {
            await expect(marketplace.pause({ from: bob })).to.be.rejected;
            await expect(marketplace.unpause({ from: bob })).to.be.rejected;
            await marketplace.pause({from: admin})
            await expect(marketplace.setListingFee(LISTING_FEE, { from: bob })).to.be.rejected;
            await expect(marketplace.updateTreasury(alice, {from: bob})).to.be.rejected;
            await expect(marketplace.updateEscrowSales(alice, {from: bob})).to.be.rejected;
            await expect(marketplace.updateEscrowListed(alice, {from: bob})).to.be.rejected;
            await expect(marketplace.setCommissionRBP(alice, {from: bob})).to.be.rejected;
            await marketplace.unpause({from: admin});
            
            await expect(marketplace.createSale(
                nft.address,
                500,
                fred, 
                bob,
                new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 6500))), 
                new web3.utils.BN(LISTING_FEE),
                900, 
                {from: fred}
            )).to.be.rejected;
            await marketplace.verifyUser(fred, {from: verifier});
            const { logs: [ { args: { saleId: saleOneId } } ] } = await marketplace.createSale(
                nft.address,
                500,
                fred, 
                bob,
                new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 6500))), 
                new web3.utils.BN(LISTING_FEE),
                900, 
                {from: fred }
            );
            await expect(marketplace.forceCloseSale(saleOneId, {from: bob})).to.be.rejected;
            const { logs: [ { args: { saleId: saleTwoId } } ] } = await marketplace.createSale(
                nft.address,
                500,
                fred,
                bob,
                new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 1))), 
                new web3.utils.BN(LISTING_FEE),
                900, 
                {from: fred }
            );
            await new Promise(resolve => {
                setTimeout(() => {
                    resolve("resolved"); 
                }, 5000)
            });
            await expect(marketplace.closeSaleOnDeadline(saleTwoId, {from: ed})).to.be.rejected;
            await expect(marketplace.grantRole(roles.Pauser, david, {from: ed})).to.be.rejected;
        }); 
        it('pauses and allows operations only from assigned roles', async () => { 
            const newListingFee = web3.utils.toWei("1", "ether");
            const start = await getStartSaleTimestamp(web3, new Date());
            const end = await getStartSaleTimestamp(web3, new Date(), 3600 * 24);
            let Err;
            try {
                await marketplace.verifyUser(ed, {from: verifier});
                const { logs: [{args: { saleId: saleOneId } } ] } = await marketplace.createSale(
                    nft.address,
                    500,
                    ed,
                    bob,
                    new web3.utils.BN(start), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(newListingFee),
                    900, 
                    {from: ed }
                );
                await marketplace.forceCloseSale(saleOneId.toNumber(), {from: ed});
                const { logs: [{ args: { saleId: saleTwoId } } ] } = await marketplace.createSale(
                    nft.address,
                    500,
                    ed,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())),
                    new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 1))), 
                    new web3.utils.BN(newListingFee),
                    900, 
                    {from: ed }
                );
                const { logs: [{ args: { saleId: saleThreeId } } ] } = await marketplace.createSale(
                    nft.address,
                    500,
                    ed,
                    bob,
                    new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 10 ))), 
                    new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 10 + 3600))), 
                    new web3.utils.BN(newListingFee),
                    900, 
                    {from: ed }
                );
                await new Promise(resolve => {
                    setTimeout(async () => {
                        await marketplace.activateFutureSale(saleThreeId, {from: admin});
                        await marketplace.closeSaleOnDeadline(saleTwoId, {from: admin});
                        resolve("resolved"); 
                    }, 11000)
                });
                await marketplace.pause({ from: admin });
                await marketplace.setListingFee(newListingFee, {from: admin});
                await marketplace.setCommissionRBP(2500, {from: admin});
                await marketplace.updateTreasury(alice, {from: admin});
                await marketplace.updateEscrowSales(alice, {from: admin});
                await marketplace.updateEscrowListed(alice, {from: admin});
                await marketplace.unpause({from: admin});
                await marketplace.grantRole(roles.Pauser, david, {from: admin});
            } catch (e){
                console.log(e);
                Err = e;
            }
            expect(Err).to.equal(undefined);
        });
    })

    context('Core functionality ...', () => {
        it('allows for resetting of listing fee', async () => {
            const newFee = web3.utils.toWei("2", "ether");
            await marketplace.pause({ from: admin });
            await marketplace.setListingFee(newFee, { from: admin });
            await marketplace.unpause({ from: admin });
            let listingFee = await marketplace.LISTING_FEE.call();
            expect(listingFee.toString()).to.equal(newFee);
        });
        it('creates sale', async () => {
            await marketplace.verifyUser(alice, {from: verifier});
            const start = await getStartSaleTimestamp(web3, new Date());
            const end = String(Math.round((new Date().getTime() / 1000) + 6500));
            const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                nft.address,
                500,
                fred,
                bob,
                new web3.utils.BN(start), 
                new web3.utils.BN(end), 
                new web3.utils.BN(LISTING_FEE),
                900, 
                {from: alice}
            );
            const sale = await marketplace.fetchSale(saleId);
            expect(representative).to.equal(alice);
            expect(sale.licenseProvider).to.equal(fred);
            expect(Number(sale.tokenId)).to.equal(1);
            expect(sale.nftContract).to.equal(nft.address);
            expect(sale.refferer).to.equal(bob);
            expect(Number(sale.soldLicenses)).to.equal(0);
            expect(Number(sale.maxSupply)).to.equal(500);
            expect(sale.price).to.equal(LISTING_FEE);
            expect(sale.active).to.equal(true);
            expect(sale.isFuture).to.equal(false);
            expect(sale.start).to.equal(start);
            expect(sale.end).to.equal(end);
            expect(saleId.toNumber()).to.equal(1);
        });
        describe("sale participation", () => {
            const price = web3.utils.toWei('0.01', 'ether');
            const maxSupply = 25;
            const toBuy = 5;
            const end = String(Math.round((new Date().getTime() / 1000) + (3600 * 24)));
            const toPay = String(Number(price) * toBuy);
            const toPayInsufficient = String(Number(price) * (toBuy - 1 ));
            it("dissalows participation if incorrect payment amount", async () => {
                await marketplace.verifyUser(alice, {from: verifier})
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred, 
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                await expect(marketplace.participate(saleId, toBuy, { from: fred, value: toPayInsufficient })).to.be.rejected;
            })
            it("dissalows participation if inactive sale", async () => {
                await marketplace.verifyUser(alice, {from: verifier})
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred, 
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                // force close the sale
                await marketplace.forceCloseSale(saleId, {from: alice}); 
                await expect(marketplace.participate(saleId, toBuy, { from: fred, value: toPay })).to.be.rejected;
            })
            it("dissalows participation if amount exceeds max supply", async () => {
                await marketplace.verifyUser(alice, {from: verifier})
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                await expect(marketplace.participate(saleId, toBuy + 25, { from: fred, value: toPay })).to.be.rejected;
            })
            it('allows users to participate in sale', async () => {
                await marketplace.verifyUser(alice, {from: verifier})
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                let Err; 
                try {
                    await marketplace.participate(saleId, toBuy, { from: fred, value: toPay });
                } catch (e){
                    Err = e;
                }
                expect(Err).to.equal(undefined);
            });
        })
        describe("sale deactivation", ()=> {
            const price = web3.utils.toWei('1', 'ether');
            const maxSupply = 25;
            const toBuy = 5;
            const toPay = String(Number(price) * toBuy);
            it('deactivates sale after supply sold', async () => {
                const end = String(Math.round((new Date().getTime() / 1000) + (3600 * 24)));
                const payment = String(Number(price) * (toBuy + 20));
                await marketplace.verifyUser(alice, {from: verifier});
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                await marketplace.participate(saleId, toBuy + 20, { from: bob, value: payment });
                const sale = await marketplace.fetchSale(saleId);
                expect(sale.active).to.equal(false);
                expect(sale.isFuture).to.equal(false);
            });
            it('deactivates sale on force close', async () => {
                const end = String(Math.round((new Date().getTime() / 1000) + (3600 * 24)));
                await marketplace.verifyUser(alice, {from: verifier})
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                await marketplace.forceCloseSale(saleId, { from: alice });
                const sale = await marketplace.fetchSale(saleId);
                expect(sale.active).to.equal(false);
                expect(sale.isFuture).to.equal(false);
            });
            it('deactivates sale on operator close', async () => {
                const end = String(Math.round((new Date().getTime() / 1000) + 10));
                await marketplace.verifyUser(alice, {from: verifier});
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(await getStartSaleTimestamp(web3, new Date())), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                await new Promise(resolve => {
                    setTimeout(async () => {
                        await marketplace.closeSaleOnDeadline(saleId, {from: admin});
                        resolve("resolved"); 
                    }, 11000)
                });
                await marketplace.closeSaleOnDeadline(saleId, { from: admin });
                const sale = await marketplace.fetchSale(saleId);
                expect(sale.active).to.equal(false);
                expect(sale.isFuture).to.equal(false);
            });
        });
        describe("sale activation", ()=>{
            it("activates future sales on operator call", async () => {
                const price = web3.utils.toWei('5', 'ether');
                const maxSupply = 25;
                const start = new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 10)));
                const end = new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + 10 + 3600)));
                await marketplace.verifyUser(alice, {from: verifier});
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(start), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                const sale = await marketplace.fetchSale(saleId);
                expect(sale.active).to.equal(false);
                expect(sale.isFuture).to.equal(true);

                await new Promise(resolve => {
                    setTimeout(async () => {
                        await marketplace.activateFutureSale(saleId, {from: admin});
                        resolve('Sale activated');
                    }, 11000);
                });

                const saleActivated = await marketplace.fetchSale(saleId);
                expect(saleActivated.active).to.equal(true);
                expect(saleActivated.isFuture).to.equal(false);
            });
        })
        describe("sale fetching", ()=> {
            const activeSales = 6;
            const maxSupply = 25;
            const inactiveSales = 7;
            const price = web3.utils.toWei('5', 'ether');
            const start = new web3.utils.BN(String(Math.round((new Date().getTime() / 1000))));
            const end = new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + (3600 * 24) )));
            it("fetches a single sale by saleId", async ()=> {
                await marketplace.verifyUser(alice, {from: verifier});
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(start), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                    );
                    const sale = await marketplace.fetchSale(saleId);
                    expect(sale).to.not.equal(undefined);
                });
            it("fetches all active- and ignores future sales", async () => {
                await marketplace.verifyUser(alice, {from: verifier});
                
                // creates 6 active sales
                await Promise.all(Array.from({ length: activeSales}).map(async el => 
                    await marketplace.createSale(nft.address, maxSupply, fred, bob, new web3.utils.BN(start), new web3.utils.BN(end), new web3.utils.BN(price), 900, 
                        { from: alice }
                    )
                ));

                // creates 6 inactive sales
                const futureStart = new web3.utils.BN(await getStartSaleTimestamp(web3, new Date(), 3600));
                await Promise.all(Array.from({length: inactiveSales}).map( async el => 
                    await marketplace.createSale(nft.address, maxSupply, carl, ed, new web3.utils.BN(futureStart), new web3.utils.BN(end), new web3.utils.BN(price), 900, 
                        { from: alice }
                    )
                ));
                const fetchedSales = await marketplace.fetchActiveSales.call();
                expect(fetchedSales.length).to.equal(activeSales);
            });
        })
        context("Licenses", () => {
            const price = web3.utils.toWei('0.5', 'ether');
            const end = new web3.utils.BN(String(Math.round((new Date().getTime() / 1000) + (3600 * 24) )));
            const maxSupply = 500;
            const toBuy = 10;
            const toPay = String(Number(price) * toBuy);
            var start;
            var listingTokenId; 
            beforeEach(async () => {
                await marketplace.verifyUser(alice, {from: verifier});
                start = new web3.utils.BN(await getStartSaleTimestamp(web3, new Date()));
                const { logs: [ { args: { representative, saleId, tokenId } } ] } = await marketplace.createSale(
                    nft.address,
                    maxSupply,
                    fred,
                    bob,
                    new web3.utils.BN(start), 
                    new web3.utils.BN(end), 
                    new web3.utils.BN(price),
                    900, 
                    { from: alice }
                );
                listingTokenId = tokenId;
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                await marketplace.participate(saleId, toBuy, { from: carl, value: toPay });
                await marketplace.participate(saleId, toBuy, { from: david, value: toPay });
            });
            describe('Listing licenses', ()=> {
                it("disallows listing if operator not approved", async ()=>{
                    const lowerListingFee = web3.utils.toWei("0.01", "ether");
                    await expect(marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 5, { from: ed, value: lowerListingFee })).to.be.rejected;
                })
                it("disallows listing if incorrect payment amount", async ()=> {
                    await nft.setApprovalForAll(marketplace.address, true, { from: ed });
                    const lowerListingFee = web3.utils.toWei("0.01", "ether");
                    await expect(marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 5, { from: ed, value: lowerListingFee })).to.be.rejected;
                })
                it("disallows listing if incorrect balance", async ()=>{
                    await nft.setApprovalForAll(marketplace.address, true, { from: carl });
                    await expect(marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 15, { from: carl, value: LISTING_FEE })).to.be.rejected;
                })
                it("lists bought license(s)", async ()=> {
                    await nft.setApprovalForAll(marketplace.address, true, { from: david });
                    const { logs: [{ args: { licenseId, tokenId, listedAmount } }]} = await marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 10, { from: david, value: LISTING_FEE });
                    const license = await marketplace.fetchLicense(licenseId);
                    expect(Number(license.licenseId)).to.equal(licenseId.toNumber());
                    expect(Number(license.status)).to.equal(listedStatus.Open);
                    expect(license.seller).to.equal(david);
                    expect(license.price).to.equal(price);
                    expect(Number(license.listedAmount)).to.equal(listedAmount.toNumber());
                    expect(license.nftContract).to.equal(nft.address);
                    expect(Number(license.tokenId)).to.equal(tokenId.toNumber());
                });
            });
            describe('Fetching licenses', () => {
                it('fetches a single listed license', async () => {
                    await nft.setApprovalForAll(marketplace.address, true, { from: carl });
                    const { logs: [{ args: { licenseId } }]} = await marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 10, { from: carl, value: LISTING_FEE });
                    const license = await marketplace.fetchLicense(licenseId);
                    expect(license).to.not.equal(undefined);
                });
                it('fetches all listed licenses', async () => {
                    const licenses = 10;
                    await nft.setApprovalForAll(marketplace.address, true, { from: carl });
                    await Promise.all(Array.from({ length: licenses }).map(async el => 
                        await marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), 1, { from: carl, value: LISTING_FEE })
                    ))
                    const listedLicenses = await marketplace.fetchListedLicenses.call();
                    expect(listedLicenses.length).to.equal(licenses); 
                });
            })
            describe('Purchasing licenses', () => {
                var owners = [david, carl, ed];
                var LL;  
                beforeEach(async () => {
                    LL = await Promise.all(owners.map(async owner => {
                        await nft.setApprovalForAll(marketplace.address, true, {from: owner });
                        const { logs: [{ args: { licenseId, tokenId, listedAmount } }]} = await marketplace.listLicense(nft.address, listingTokenId, new web3.utils.BN(price), Math.floor(Math.random() * 10) + 1, { from: owner, value: LISTING_FEE });
                        return {
                            licenseId: licenseId.toNumber(), 
                            tokenId: tokenId.toNumber(), 
                            listedAmount: listedAmount.toNumber()
                        }
                    }
                    ))
                })
                it('disallows purchase if incorrect payment amount', async () => {
                    await expect(marketplace.purchaseLicense(Number(LL[0].licenseId), Number(LL[0].listedAmount), { from: alice, value: LISTING_FEE })).to.be.rejected;
                });
                it('disallows purchase if nft amount exceeds listed', async () => {
                    const license = await marketplace.fetchLicense(LL[0].licenseId);
                    const toBuy = Number(LL[0].listedAmount) + 5;
                    const toPay = Number(license.price) * toBuy;
                    await expect(marketplace.purchaseLicense(Number(LL[0].licenseId), toBuy, { from: alice, value: toPay })).to.be.rejected; 
                });
                it('closes listing on listed total listed amount sold', async () => {
                    const license = await marketplace.fetchLicense(LL[1].licenseId);
                    const toBuy = Number(LL[1].listedAmount);
                    const toPay = Number(license.price) * toBuy;
                    const {logs: [, { args: { licenseId }  }]} = await marketplace.purchaseLicense(LL[1].licenseId, toBuy, { from: alice, value: toPay });
                    const boughtLicense = await marketplace.fetchLicense(licenseId);
                    expect(Number(boughtLicense.status)).to.be.equal(listedStatus.Closed);
                })
                it('disallows purchase of listed licenses with closed status', async () => {
                    const license = await marketplace.fetchLicense(LL[1].licenseId);
                    const toBuy = Number(LL[1].listedAmount);
                    const toPay = Number(license.price) * toBuy;
                    await marketplace.purchaseLicense(LL[1].licenseId, toBuy, { from: alice, value: toPay });
                    await expect(marketplace.purchaseLicense(LL[1].licenseId, toBuy, { from: bob, value: toPay })).to.be.rejected;
                });
                it('allows purchase of a listed license', async () => {
                    const license = await marketplace.fetchLicense(LL[1].licenseId);
                    const toBuy = Number(LL[1].listedAmount);
                    const toPay = Number(license.price) * toBuy;
                    await marketplace.purchaseLicense(LL[1].licenseId, toBuy, { from: alice, value: toPay });
                    await expect(marketplace.purchaseLicense(LL[1].licenseId, toBuy, { from: bob, value: toPay })).to.be.rejected;
                });
            });
        })
    });
    
    context('Royalties and Escrow', ()=> {
        const price = web3.utils.toWei('0.5', 'ether');
        const maxSupply = 500;
        const toBuy = 10;
        const toPay = String(Number(price) * toBuy);
        const rbp = 900;
        const commission = ((2000/10000) * Number(toPay));
        var start, end;
        var saleTokenId, saleId;
        beforeEach(async () => {
            await marketplace.verifyUser(ed, {from: verifier});
            start = new web3.utils.BN(await getStartSaleTimestamp(web3, new Date()));
            end = new web3.utils.BN(await getStartSaleTimestamp(web3, new Date(), 3600 * 24));
            const { logs: [ { args: { representative, saleId: saleIdOne, tokenId } } ] } = await marketplace.createSale(
                nft.address,
                maxSupply,
                alice,
                david,
                new web3.utils.BN(start), 
                new web3.utils.BN(end), 
                new web3.utils.BN(price),
                rbp, 
                { from: ed }
            );
            saleId = saleIdOne;
            saleTokenId = tokenId.toNumber();
        });
        describe('Royalty assignment and calculation', () => {
            it('assigns the correct royalties to users', async () => {
                const [libPart] = await nft.getHeirloomV1Royalties(saleTokenId, { from: ed });
                expect(libPart.representative).to.equal(ed);
                expect(libPart.licenseProvider).to.equal(alice);
                expect(Number(libPart.value)).to.equal(rbp);
            });
            it('charges correct commission from participation in sale', async () => {
                const startBTreasury = await web3.eth.getBalance(treasury);
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                await marketplace.participate(saleId, toBuy, { from: carl, value: toPay });
                const currentBTreasury = await web3.eth.getBalance(treasury);
                const commissionPaid = Number(currentBTreasury) - Number(startBTreasury);
                expect(commissionPaid / 1e18).to.equal((commission * 2) / 1e18);
            });
            it('deposits correct payment from participation in sale', async () => {
                const escrowBBAlice = await escrowSales.nativeDepositsOf({from: ed});
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                const escrowBAAlice = await escrowSales.nativeDepositsOf({from: ed});
                const diff = escrowBAAlice.sub(escrowBBAlice);
                expect(diff.toString()).to.equal(String(toPay - commission));
            });
            it('charges correct fee for listing a license', async () => {
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                await nft.setApprovalForAll(marketplace.address, true, {from: ed});
                const startBTreasury = await web3.eth.getBalance(treasury);
                await marketplace.listLicense(nft.address, saleTokenId, new web3.utils.BN(price), toBuy, { from: ed, value: LISTING_FEE }) 
                const currentBTreasury = await web3.eth.getBalance(treasury);
                const feePaid = Number(currentBTreasury) - Number(startBTreasury);
                expect(feePaid).to.equal(Number(LISTING_FEE));
            });
            it('deposits the correct purchase amount to license seller', async () => {
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                await nft.setApprovalForAll(marketplace.address, true, {from: ed});
                const {logs: [{args: { licenseId } }]} = await marketplace.listLicense(nft.address, saleTokenId, new web3.utils.BN(price), toBuy, { from: ed, value: LISTING_FEE });
                const royalty = (rbp / 10000) * Number(toPay);
                const toReceiveEd = Number(toPay) - royalty;
                await marketplace.purchaseLicense(licenseId.toNumber(), toBuy, {value: toPay, from: alice}); 
                const escrowBEd = await escrowListed.nativeDepositsOf({from: ed});
                expect(escrowBEd.toString()).to.equal(String(toReceiveEd));
            });
            it('deposits the correct royalty amount to license provider', async () => {
                await marketplace.participate(saleId, toBuy, { from: ed, value: toPay });
                await nft.setApprovalForAll(marketplace.address, true, {from: ed});
                const {logs: [{args: { licenseId } }]} = await marketplace.listLicense(nft.address, saleTokenId, new web3.utils.BN(price), toBuy, { from: ed, value: LISTING_FEE });
                const royalty = (rbp / 10000) * Number(toPay);
                const escrowBBAlice = await escrowSales.nativeDepositsOf({from: ed});
                await marketplace.purchaseLicense(licenseId.toNumber(), toBuy, {value: toPay, from: alice}); 
                const escrowBAAlice = await escrowSales.nativeDepositsOf({from: ed});
                const diff = escrowBAAlice.sub(escrowBBAlice);
                expect(diff.toString()).to.equal(String(royalty));
            });
            it('allows license providers to withdraw from escrow', async () => {
                await marketplace.participate(saleId, toBuy, { from: carl, value: toPay });
                const aliceBB = await web3.eth.getBalance(alice);
                await escrowSales.withdrawNative({from: ed});
                const aliceBA = await web3.eth.getBalance(alice);
                expect(Number(aliceBA)).to.be.above(Number(aliceBB));
            });
            it('allows listers to withdraw from escrow', async () => {
                await marketplace.participate(saleId, toBuy, { from: david, value: toPay });
                await nft.setApprovalForAll(marketplace.address, true, { from: david });
                const {logs: [{args: { licenseId } }]} = await marketplace.listLicense(nft.address, saleTokenId, new web3.utils.BN(price), toBuy, { from: david, value: LISTING_FEE });
                await marketplace.purchaseLicense(licenseId.toNumber(), toBuy, { value: toPay, from: admin });
                const davidBB = await web3.eth.getBalance(david);
                await escrowListed.withdrawNative({from: david});
                const davidBA = await web3.eth.getBalance(david);
                expect(Number(davidBA)).to.be.above(Number(davidBB));
            });
        })
    });

});
