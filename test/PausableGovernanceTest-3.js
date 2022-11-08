const helper = require("../helpers/utils.js");
const truffleAssert = require("truffle-assertions");
const GovernanceTokenPausable = artifacts.require("GovernanceTokenPausable");

const yearInSeconds = 31536000;
const timeAllowance = 1000; // Sometimes tests throws an error because vestTime should be in the future
const tokensToLock = 1000;

contract("GovernanceTokenPausable", (accounts) => {
  let instance;

  beforeEach(async () => {
    instance = await GovernanceTokenPausable.deployed();
  });

  it(`should be able to transfer ${tokensToLock} to accounts[0] when not paused`, async () => {
    await truffleAssert.passes(
      instance.transfer(accounts[0], tokensToLock, {
        from: accounts[9],
      })
    );
  });

  it(`should not be able to transfer ${tokensToLock} to accounts[0] when paused`, async () => {
    await instance.pause({ from: accounts[0] });
    await truffleAssert.fails(
      instance.transfer(accounts[0], tokensToLock, { from: accounts[9] }),
      truffleAssert.ErrorType.REVERT,
      "Pausable: paused"
    );
  });

  it(`should NOT be able to pause if not owner`, async () => {
    await instance.unPause({ from: accounts[0] });
    await truffleAssert.fails(
      instance.pause({ from: accounts[9] }),
      truffleAssert.ErrorType.REVERT,
      "Ownable: caller is not the owner."
    );
  });

  it(`should NOT be able to unPause if not owner`, async () => {
    await instance.pause({ from: accounts[0] });
    await truffleAssert.fails(
      instance.unPause({ from: accounts[9] }),
      truffleAssert.ErrorType.REVERT,
      "Ownable: caller is not the owner."
    );
  });



  it(`should be able to timelock ${tokensToLock} tokens and emit NewTokenLock event`, async () => {
    await instance.unPause({ from: accounts[0] });

    const latestBlock = await web3.eth.getBlock("latest");

    const result = await instance.newTimeLock(
      tokensToLock,
      latestBlock.timestamp + timeAllowance,
      latestBlock.timestamp + yearInSeconds / 2,
      yearInSeconds,
      { from: accounts[0] }
    );

    truffleAssert.eventEmitted(result, "NewTokenLock");
  });

  it(`should be able to have ${
    tokensToLock / 2
  } unlocked balance after cliff time`, async () => {
    await helper.advanceTimeAndBlock(yearInSeconds / 2 + timeAllowance);
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);

    assert.equal(balanceUnlocked.toNumber(), tokensToLock / 2);
  });

  it("should be able to transfer 200 to accounts[1]", async () => {
    await truffleAssert.passes(
      instance.transfer(accounts[1], 200, {
        from: accounts[0],
      })
    );
  });

  it("should be able to transfer 200 to accounts[2]", async () => {
    await truffleAssert.passes(
      instance.transfer(accounts[2], 200, {
        from: accounts[0],
      })
    );
  });
});
