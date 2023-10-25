const HeirloomEscrow = artifacts.require("HeirloomEscrow.sol");
const HeirloomToken = artifacts.require("HeirloomToken.sol");
const chai = require('chai');

const should = chai.should();
const expect = chai.expect;
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const { roles } = require('./roles.js');

contract('Heirloom Escrow', (accounts)=> {
    const [admin, treasury, main, pauser, alice, bob, carl, ed, david, fred] = accounts;
    const supply = new web3.utils.BN(web3.utils.toWei('10000000', 'ether'));
    var token, escrow;
    beforeEach(async ()=> {
        token = await HeirloomToken.new(treasury, supply, { from: admin });
        escrow = await HeirloomEscrow.new(token.address, admin, { from: admin});
    });


    context("Initialization", ()=> {
        it('sets the correct roles', async ()=> {
            const adminIsAdmin = await escrow.hasRole(roles.Admin, admin);
            const pauserIsPauser = await escrow.hasRole(roles.Pauser, admin);
            const escrowIsEscrow = await escrow.hasRole(roles.Escrow, admin);
            expect(adminIsAdmin).to.be.true;
            expect(pauserIsPauser).to.be.true;
            expect(escrowIsEscrow).to.be.true;
        });
        it('sets the correct tokenAddress', async ()=> {
            const tokenAddress = await escrow.getToken({from: admin});
            expect(tokenAddress).to.equal(token.address);
        });
    });
    context("Security", ()=> {
        it('rejects operations from unauthorized roles', async ()=> {
            await expect(escrow.updateToken(alice, {from: alice})).to.be.rejected;
            await expect(escrow.getToken({from: alice})).to.be.rejected;
            await expect(escrow.accountExists(alice, {from: alice})).to.be.rejected;
            await expect(escrow.depositNative(alice, {from: alice, value: web3.utils.toWei('1', 'ether')})).to.be.rejected;
            await expect(escrow.depositERC20(alice, new web3.utils.BN(web3.utils.toWei('1', 'ether')), {from: alice})).to.be.rejected;
            await expect(escrow.createAccount(alice, bob, new web3.utils.BN(web3.utils.toWei('1', 'ether')), {from: bob})).to.be.rejected;
            
            // depost first
            await escrow.createAccount(bob, bob, { from: admin });
            await token.approve(escrow.address, new web3.utils.BN(web3.utils.toWei('1', 'ether')), {from: bob});
            await expect(escrow.withdrawERC20({from: fred})).to.be.rejected;
            
            // deposit first
            await escrow.createAccount(carl, carl, { from: admin });
            await escrow.depositNative(carl, {value: web3.utils.toWei('1', 'ether'), from: admin});
            await expect(escrow.withdrawERC20({from: fred})).to.be.rejected;
            
            await expect(escrow.erc20DepositsOf(alice, {from: fred})).to.be.rejected;
            await expect(escrow.nativeDepositsOf(alice, {from: fred})).to.be.rejected;
            await expect(escrow.pause({from: fred})).to.be.rejected;
            await expect(escrow.unpause({from: fred})).to.be.rejected;

        });
        it('accepts operations from authorized roles', async ()=> {

            let Err;
            try {
                await escrow.getToken({from: admin});
                await escrow.accountExists(alice, {from: admin});
                
                await escrow.createAccount(alice, alice, {from: admin});
                await escrow.depositNative(alice, {from: admin, value: web3.utils.toWei('1', 'ether')});
                await escrow.nativeDespositsOf({from: alice});
                await escrow.depositERC20(alice, new web3.utils.BN(web3.utils.toWei('1', 'ether')), {from: admin});
                await escrow.erc20DepositsOf(alice, {from: fred});
                await escrow.withdrawNative({from: alice});
                await escrow.withdrawERC20({from: alice});
                
                await escrow.pause({from: admin});
                await escrow.updateToken(alice, {from: admin});
                await escrow.pause({from: admin});

            } catch (e){
                expect(Err).to.equal(undefined)
            }
        });
    });
    context("Core functionality", ()=> {
        describe("Accounts", ()=>{
            it('creates accounts', async ()=> {
                await escrow.createAccount(alice, alice, {from: admin});
                const existsAlice = await escrow.accountExists(alice, {from: admin});
                expect(existsAlice).to.be.true; 
            });
            it('allows account to only be created once', async ()=> {
                await escrow.createAccount(alice, alice, {from: admin})
                await expect(escrow.createAccount(alice, alice, {from: admin})).to.be.rejected;
            });
        })
        describe("Deposits", ()=>{
            it('allows for deposits', async ()=> {
                await escrow.createAccount(alice, alice, {from: admin})
                await token.transfer(escrow.address, new web3.utils.BN(web3.utils.toWei('2', 'ether')), { from: treasury });
                await escrow.depositERC20(alice, new web3.utils.BN(web3.utils.toWei('1', 'ether')), {from: admin});
                await escrow.depositNative(alice, {from: admin, value: web3.utils.toWei('1', 'ether')});
                
                const nativeBalance = await escrow.nativeDepositsOf({from: alice});
                const ercBalance = await escrow.erc20DepositsOf({from: alice});
                expect(nativeBalance.toString()).to.equal(web3.utils.toWei('1', 'ether'));
                expect(ercBalance.toString()).to.equal(web3.utils.toWei('1', 'ether'));
            });
        })
        describe("Withdraws", ()=>{
            it('allows for withdraws from depositors', async ()=> {
                await escrow.createAccount(main, alice, {from: admin});
                await token.transfer(escrow.address, new web3.utils.BN(web3.utils.toWei('2', 'ether')), { from: treasury });
                await escrow.depositERC20(alice, new web3.utils.BN(web3.utils.toWei('2', 'ether')), {from: admin});
                await escrow.depositNative(alice, {from: admin, value: web3.utils.toWei('5', 'ether')}); 
                await escrow.withdrawNative({from: alice});
                await escrow.withdrawERC20({from: alice});
                const nativeBalance = await web3.eth.getBalance(main);
                const ercBalance = await token.balanceOf(main);
                expect(Number(web3.utils.fromWei(nativeBalance, "ether"))).to.equal(1000 + 5);
                expect(ercBalance / 1e18).to.equal(2);
            });
        })
    });
})