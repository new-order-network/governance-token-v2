const helper = require("../helpers/utils.js");
const truffleAssert = require("truffle-assertions");
const TimeLockToken = artifacts.require("TimeLockToken");

const yearInSeconds = 31536000;
const tokensToLock = 1000;

contract("TimeLockToken", (accounts) => {
  let instance;

  beforeEach(async () => {
    instance = await TimeLockToken.deployed();
  });

  it(`should be able to transfer ${tokensToLock} to accounts[0]`, async () => {
    await truffleAssert.passes(
      instance.transfer(accounts[0], tokensToLock, {
        from: accounts[9],
      })
    );
  });

  it(`should be able to timelock ${tokensToLock} tokens and emit NewTokenLock event`, async () => {
    const latestBlock = await web3.eth.getBlock("latest");

    const result = await instance.newTimeLock(
      tokensToLock,
      latestBlock.timestamp + 1,
      latestBlock.timestamp + yearInSeconds / 2,
      yearInSeconds,
      { from: accounts[0] }
    );

    truffleAssert.eventEmitted(result, "NewTokenLock");
  });

  it(`should be able to have ${
    tokensToLock / 2
  } unlocked balance after cliff time`, async () => {
    await helper.advanceTimeAndBlock(yearInSeconds / 2 + 1);
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

  // THIS IS THE TEST THAT FAILS
  it("should be able to transfer 200 to accounts[2]", async () => {
    await truffleAssert.passes(
      instance.transfer(accounts[2], 200, {
        from: accounts[0],
      })
    );
  });
});
