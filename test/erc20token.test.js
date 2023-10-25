const chai = require('chai');
const HeirloomToken = artifacts.require("HeirloomToken.sol");
const should = chai.should();
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const web3 = require('web3');
const { roles } = require('./roles.js');

contract('HeirloomToken', (accounts) => {
    const admin = accounts[0];
    const treasury = accounts[9];
    const supply = new web3.utils.BN(web3.utils.toWei('10000000', 'ether'));
    var tokenContract;

    beforeEach(async () => {
        /* before each context */
        tokenContract = await HeirloomToken.new(treasury, supply, { from: admin }); 
    })

    context('Initialization', () => {
        it('sets the correct supply ...', async () => {
            const treasuryBalance = await tokenContract.balanceOf(treasury, { from: admin });
            const totalSupply = await tokenContract.totalSupply();
            expect(web3.utils.fromWei(treasuryBalance.toString(), 'ether')).to.equal(web3.utils.fromWei(totalSupply.toString(), 'ether'));
        });
        it('sets the correct roles ...', async () => {
            const msgSenderHasAdmin = await tokenContract.hasRole(roles.Admin, admin);
            const msgSenderHasSnapshot = await tokenContract.hasRole(roles.SnapShot, admin);
            const msgSenderHasPauser = await tokenContract.hasRole(roles.Pauser, admin);
            const msgSenderHasMinter = await tokenContract.hasRole(roles.Minter, admin);
            expect(msgSenderHasAdmin).to.be.true;
            expect(msgSenderHasSnapshot).to.be.true;
            expect(msgSenderHasPauser).to.be.true;
            expect(msgSenderHasMinter).to.be.true;
        });
    })

    context('security tests', () => {
        it('only roles can perform tasks', async () => {
            const [, alice, bob, carl, david, ed] = accounts;  
            await expect(tokenContract.pause({from: alice})).to.be.rejected;
            await expect(tokenContract.snapshot({from: bob})).to.be.rejected;
            await expect(tokenContract.mint(bob, web3.utils.toWei("10000", 'ether'), {from: bob})).to.be.rejected;
            await expect(tokenContract.grantRole(roles.Minter, david, {from: carl})).to.be.rejected
            let Err;
            try {
                await tokenContract.snapshot({from: admin});
                await tokenContract.mint(bob, web3.utils.toWei("10000", 'ether'), {from: admin});
                await tokenContract.grantRole(roles.Minter, david, {from: admin});
                await tokenContract.pause({from: admin})
            } catch (e){
                Err = e;
            }
            expect(Err).to.equal(undefined);
        });
    })
});
