const helper = require("../helpers/utils.js");
const truffleAssert = require("truffle-assertions");
const TimeLockToken = artifacts.require("TimeLockToken");

const dayInSeconds = 86400;
const tokensToLock = 2000;

contract("TimeLockToken", (accounts) => {
  it("should balance of accounts[0] be equal to unlocked balance", async () => {
    let instance = await TimeLockToken.deployed();
    const balance = await instance.balanceOf(accounts[0]);
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);
    assert.equal(balance.toNumber(), balanceUnlocked.toNumber());
  });

  it("should not be able to timelock 0 tokens", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    await truffleAssert.fails(
      instance.newTimeLock(
        0,
        latestBlock.timestamp + dayInSeconds,
        latestBlock.timestamp + dayInSeconds * 2,
        dayInSeconds * 4,
        { from: accounts[0] }
      ),
      "Cannot timelock 0 tokens"
    );
  });

  it("should not be able to timelock more tokens than balance", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");
    const balance = await instance.balanceOf(accounts[0]);

    await truffleAssert.fails(
      instance.newTimeLock(
        balance + 1000,
        latestBlock.timestamp + dayInSeconds,
        latestBlock.timestamp + dayInSeconds * 2,
        dayInSeconds * 4,
        { from: accounts[0] }
      ),
      "Cannot timelock more tokens than current balance"
    );
  });

  it("should not be able to timelock if disbursement period is 0", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    await truffleAssert.fails(
      instance.newTimeLock(
        tokensToLock,
        latestBlock.timestamp + dayInSeconds,
        latestBlock.timestamp + dayInSeconds * 2,
        0,
        { from: accounts[0] }
      ),
      "Cannot have disbursement period of 0"
    );
  });

  it("should not be able to timelock if the start date is less than current timestamp", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    await truffleAssert.fails(
      instance.newTimeLock(
        tokensToLock,
        latestBlock.timestamp - dayInSeconds,
        latestBlock.timestamp + dayInSeconds * 2,
        dayInSeconds * 4,
        { from: accounts[0] }
      ),
      "vesting start must be in the future"
    );
  });

  it("should not be able to timelock if the cliff timestamp is lower than the vesting timestamp", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    await truffleAssert.fails(
      instance.newTimeLock(
        tokensToLock,
        latestBlock.timestamp + dayInSeconds,
        latestBlock.timestamp - dayInSeconds,
        dayInSeconds * 4,
        { from: accounts[0] }
      ),
      "cliff must be at same time as vesting starts (or later)"
    );
  });

  it(`should be able to timelock ${tokensToLock} tokens and emit NewTokenLock event`, async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    const result = await instance.newTimeLock(
      tokensToLock,
      latestBlock.timestamp + dayInSeconds,
      latestBlock.timestamp + dayInSeconds * 2,
      dayInSeconds * 4,
      { from: accounts[0] }
    );

    truffleAssert.eventEmitted(result, "NewTokenLock");
  });

  it(`should have ${tokensToLock} as the locked amount`, async () => {
    let instance = await TimeLockToken.deployed();
    const balanceLocked = await instance.balanceLocked(accounts[0]);

    assert.equal(balanceLocked, tokensToLock);
  });

  it("should not be able to timelock more tokens if there is currently locked balance", async () => {
    let instance = await TimeLockToken.deployed();
    const latestBlock = await web3.eth.getBlock("latest");

    await truffleAssert.fails(
      instance.newTimeLock(
        tokensToLock,
        latestBlock.timestamp + dayInSeconds,
        latestBlock.timestamp + dayInSeconds * 2,
        dayInSeconds * 4,
        { from: accounts[0] }
      ),
      "Cannot timelock additional tokens while tokens already locked"
    );
  });

  it(`unlocked balance should be ${tokensToLock} tokens less of total balance`, async () => {
    let instance = await TimeLockToken.deployed();
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);
    const balance = await instance.balanceOf(accounts[0]);

    assert.equal(balanceUnlocked, balance - tokensToLock);
  });

  it("should not be able to transfer tokens greater than unlocked balance", async () => {
    let instance = await TimeLockToken.deployed();
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);

    await truffleAssert.fails(
      instance.transfer(accounts[1], balanceUnlocked + 1000, {
        from: accounts[0],
      }),
      "amount exceeds available unlocked tokens"
    );
  });

  it("should be able to transfer unlocked balance", async () => {
    let instance = await TimeLockToken.deployed();
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);

    await truffleAssert.passes(
      instance.transfer(accounts[1], balanceUnlocked, {
        from: accounts[0],
      })
    );
  });

  it("should not be able to transfer locked tokens if the timestamp is not over the cliff time", async () => {
    let instance = await TimeLockToken.deployed();
    const balanceLocked = await instance.balanceLocked(accounts[0]);
    await truffleAssert.fails(
      instance.transfer(accounts[1], balanceLocked, {
        from: accounts[0],
      }),
      "amount exceeds available unlocked tokens"
    );
  });

  it(`should be able to transfer ${
    tokensToLock / 2
  } locked tokens after the timestamp passes the cliff time`, async () => {
    let instance = await TimeLockToken.deployed();
    const balanceLocked = await instance.balanceLocked(accounts[0]);
    await helper.advanceTimeAndBlock(dayInSeconds * 3);

    await truffleAssert.passes(
      instance.transfer(accounts[1], balanceLocked / 2, {
        from: accounts[0],
      })
    );
  });

  it(`should be able to unlock ${
    tokensToLock / 2
  } of the balance after disbursement period`, async () => {
    let instance = await TimeLockToken.deployed();
    await helper.advanceTimeAndBlock(dayInSeconds * 7);
    const balanceUnlocked = await instance.balanceUnlocked(accounts[0]);

    assert.equal(balanceUnlocked.toNumber(), tokensToLock / 2);
  });
});
