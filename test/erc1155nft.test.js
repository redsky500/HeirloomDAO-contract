const chai = require('chai');
const HeirloomNFT = artifacts.require("HeirloomLicenseNFT.sol");
const should = chai.should();
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const web3 = require('web3');
const { roles } = require('./roles.js');

contract('HeirloomLiceseNFT', (accounts) => {
    const admin = accounts[0];
    const operator = accounts[1];
    const uri = "http://localhost:3001/license/metadata/"
    var nft;

    beforeEach(async () => {
        /* before each context */
        nft = await HeirloomNFT.new(uri, operator, admin, { from: admin }); 
    });

    context('Initialization ...', () => {
        const [, , alice, bob, carl, david] = accounts;
        it('sets the correct uri', async () => {
            const uriOnContract = await nft.uri(0);
            expect(uriOnContract).to.equal(uri);
        });
        it('sets the correct roles', async () => {
            const adminHasAdmin = await nft.hasRole(roles.Admin, admin);
            const operatorHasMinter = await nft.hasRole(roles.Minter, operator);
            expect(adminHasAdmin).to.be.true;
            expect(operatorHasMinter).to.be.true;
        });
    })

    context('security tests ...', () => {
        const [, , alice, bob, carl, david] = accounts;  
        it('rejects operations from unassigned roles', async () => {
            await expect(nft.setURI("http://new-uri:3001", {from: alice})).to.be.rejected;
            await expect(nft.createLicense(bob, 10, new web3.utils.BN('10000'), {from: bob})).to.be.rejected;
            await expect(nft.grantRole(roles.Minter, david, {from: carl})).to.be.rejected
            await expect(nft.pause({from: alice})).to.be.rejected;
            await expect(nft.unpause({from: alice})).to.be.rejected;
        });
        it('allows operations only from assigned roles', async () => {
            let Err;
            try {
                await nft.setURI("http://new-uri:3001", {from: admin});
                // await nft.unpause({ from: admin })
                await nft.createLicense(bob, 10, new web3.utils.BN('1000'), {from: operator});
                await nft.grantRole(roles.Minter, david, {from: admin});
                await nft.pause({ from: admin });
                await nft.unpause({ from: admin });
                await nft.revokeApprovalForAll(alice, { from: operator });
            } catch (e) {
                Err = e;
            }
            expect(Err).to.equal(undefined);
        });
        it("sets the royalties interface", async () => {
            const supportsRoyaltyInterface = await nft.supportsInterface("0xb9220a74");
            expect(supportsRoyaltyInterface).to.equal(true);
        });
        it("pauses functionality", async () => {
            await nft.pause({ from: admin });
            await expect(nft.createLicense(bob, 10, new web3.utils.BN('1000'), {from: alice})).to.be.rejected;            
        })
    })

    context('core functionality ...', () => {
        const [, , alice, bob, carl, david] = accounts;  
        it('mints a saas license', async () => {
            const tokenId = await nft.createLicense.call(alice, 10, new web3.utils.BN('1000'), {from: operator });
            await nft.createLicense(alice, 10, new web3.utils.BN('1000'), {from: operator });
            const aliceBalance = await nft.balanceOf(alice, 1);
            expect(tokenId.toNumber()).to.equal(1);
            expect(aliceBalance.toNumber()).to.equal(10); 
        });
        it('increments tokenIds chronologically', async () => {
            await nft.createLicense(alice, 10, new web3.utils.BN('1000'), {from: operator });
            await nft.createLicense(bob, 10, new web3.utils.BN('1000'), {from: operator });
            await nft.createLicense(carl, 10, new web3.utils.BN('1000'), {from: operator });
            const tokenId = await nft.createLicense.call(carl, 10, new web3.utils.BN('1000'), {from: operator });
            expect(tokenId.toNumber()).to.equal(4);
        });
        it('sets the correct rbp', async () =>{
            await nft.createLicense(alice, 10, new web3.utils.BN('500'), {from: operator });
            const royalties = await nft.getHeirloomV1Royalties.call(1);
            expect(Number(royalties[0].value)).to.equal(500);
        });
    })

});
