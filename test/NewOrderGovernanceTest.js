const OpenGovernance = artifacts.require("TimeLockToken");

//https://github.com/ejwessel/GanacheTimeTraveler
const helper = require("../helpers/utils.js");

const initial_tokens = 10000;

const verbose = false;
/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("TimeLockToken", function (accounts) {
  //const wallet = accounts[0]
  // const walletTo = accounts[1]
  let token; //: Contract;
  const tokenName = "New Order";
  const tokenSymbol = "NEWO";
  //const tokenDecimals = 1
  beforeEach(async () => {
    snapShot = await helper.takeSnapshot();
    snapshotId = snapShot["result"];
  });

  afterEach(async () => {
    await helper.revertToSnapshot(snapshotId);
  });
  beforeEach(async () => {
    token = await OpenGovernance.new(
      tokenName,
      "NEWO",
      initial_tokens,
      accounts[0]
    );
    // console.log(token.address)
  });

  it(
    "creation: should create an initial balance of " +
      initial_tokens +
      " for the creator",
    async () => {
      const balance = await token.balanceOf.call(accounts[0]);
      assert.strictEqual(balance.toNumber(), 10000);
    }
  );

  it("creation: test correct setting of vanity information", async () => {
    const name = await token.name.call();
    assert.equal(name, tokenName);

    const symbol = await token.symbol.call();
    assert.strictEqual(symbol, tokenSymbol);
  });

  it("creation: test correct setting of decimals", async () => {
    const decimals = await token.decimals.call();
    assert.strictEqual(decimals.toNumber(), 18);
  });

  it("creation: test correct setting of totalSupply", async () => {
    const totalSupply = await token.totalSupply.call();
    assert.equal(totalSupply.toNumber(), 10000);
  });

  // TRANSFERS
  // normal transfers without approvals
  it("transfers: ether transfer should be reversed.", async () => {
    let threw = false;
    try {
      await web3.eth.sendTransaction({
        from: accounts[0],
        to: token.address,
        value: web3.utils.toWei("10", "Ether"),
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("transfers: should transfer 10000 to accounts[1] with accounts[0] having 0 afterwards", async () => {
    await token.transfer(accounts[1], 10000, { from: accounts[0] });
    const balance = await token.balanceOf.call(accounts[1]);
    assert.strictEqual(balance.toNumber(), 10000);
    //console.log ("balance of A1 after transfer " + balance.toNumber())

    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 0);
    //console.log ("balance of A0 after transfer " + balance0.toNumber())
  });

  it("transfers: should fail when trying to transfer 10001 to accounts[1] with accounts[0] having 10000", async () => {
    let threw = false;
    try {
      await token.transfer(accounts[1], 10001, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("transfers: should handle zero-transfers normally", async () => {
    assert(
      await token.transfer(accounts[1], 0, { from: accounts[0] }),
      "zero-transfer has failed"
    );
  });

  // NOTE: testing uint256 wrapping is impossible since you can't supply > 2^256 -1
  // todo: transfer max amounts

  // APPROVALS
  it("approvals: msg.sender should approve 100 to accounts[1]", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance.toNumber(), 100);
  });

  // bit overkill. But is for testing a bug
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 20 once.", async () => {
    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 10000);

    await token.approve(accounts[1], 100, { from: accounts[0] }); // 100
    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 0, "balance2 not correct");

    //await token.transferFrom(accounts[ 0 ], accounts[ 2 ], 20, { from: accounts[ 1 ] })
    //await token.allowance.call(accounts[ 0 ], accounts[ 1 ])
    await token.transferFrom(accounts[0], accounts[2], 20, {
      from: accounts[1],
    }); // -20
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 80); // =80

    const balance22 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance22.toNumber(), 20);

    const balance02 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance02.toNumber(), 9980);
  });

  // should approve 100 of msg.sender & withdraw 50, twice. (should succeed)
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 20 twice.", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await token.transferFrom(accounts[0], accounts[2], 20, {
      from: accounts[1],
    });
    const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 80);

    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 20);

    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 9980);

    // FIRST tx done.
    // onto next.
    await token.transferFrom(accounts[0], accounts[2], 20, {
      from: accounts[1],
    });
    const allowance013 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance013.toNumber(), 60);

    const balance22 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance22.toNumber(), 40);

    const balance02 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance02.toNumber(), 9960);
  });

  // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
  it("approvals: msg.sender approves accounts[1] of 100 & withdraws 50 & 60 (2nd tx should fail)", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await token.transferFrom(accounts[0], accounts[2], 50, {
      from: accounts[1],
    });
    const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 50);

    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 50);

    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 9950);

    // FIRST tx done.
    // onto next.
    let threw = false;
    try {
      await token.transferFrom(accounts[0], accounts[2], 60, {
        from: accounts[1],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("approvals: attempt withdrawal from account with no allowance (should fail)", async () => {
    let threw = false;
    try {
      await token.transferFrom(accounts[0], accounts[2], 60, {
        from: accounts[1],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("approvals: allow accounts[1] 100 to withdraw from accounts[0]. Withdraw 60 and then approve 0 & attempt transfer.", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    await token.transferFrom(accounts[0], accounts[2], 60, {
      from: accounts[1],
    });
    await token.approve(accounts[1], 0, { from: accounts[0] });
    let threw = false;
    try {
      await token.transferFrom(accounts[0], accounts[2], 10, {
        from: accounts[1],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("approvals: approve max (2^256 - 1)", async () => {
    await token.approve(
      accounts[1],
      "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      { from: accounts[0] }
    );
    const allowance = await token.allowance(accounts[0], accounts[1]);
    assert.strictEqual(
      allowance.toString(),
      "115792089237316195423570985008687907853269984665640564039457584007913129639935"
    );
  });

  // should approve max of msg.sender & withdraw 20 should deduct 20 from allowance.
  it("approvals: msg.sender approves accounts[1] of max (2^256 - 1) & withdraws 20", async () => {
    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 10000);

    const max =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const allowanceAfterTransfer =
      "115792089237316195423570985008687907853269984665640564039457584007913129639915";
    await token.approve(accounts[1], max, { from: accounts[0] });
    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 0, "balance2 not correct");

    await token.transferFrom(accounts[0], accounts[2], 20, {
      from: accounts[1],
    });
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toString(), allowanceAfterTransfer);

    const balance22 = await token.balanceOf.call(accounts[2]);
    //console.log(balance22.toNumber())
    assert.strictEqual(balance22.toNumber(), 20);

    const balance02 = await token.balanceOf.call(accounts[0]);
    //console.log(balance02.toNumber())
    assert.strictEqual(balance02.toNumber(), 9980);
  });

  it("approvals: increaseAllowance increases the number of approved tokens", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    await token.increaseAllowance(accounts[1], 60, { from: accounts[0] });

    await token.transferFrom(accounts[0], accounts[2], 160, {
      from: accounts[1],
    });
    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(
      balance2.toNumber(),
      160,
      "balance of account 2 not correct"
    );
  });

  it("approvals: decreaseAllowance decreases the number of approved tokens", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    await token.decreaseAllowance(accounts[1], 60, { from: accounts[0] });

    await token.transferFrom(accounts[0], accounts[2], 30, {
      from: accounts[1],
    });
    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(
      balance2.toNumber(),
      30,
      "balance of account 2 not correct"
    );

    let threw = false;
    try {
      await token.transferFrom(accounts[0], accounts[2], 20, {
        from: accounts[1],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "was allowed to transfer too many tokens after decreaseAllowance"
    );
  });

  it("approvals: decreaseAllowance prevents subtractedValue from being greater than current allowance ", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });

    let threw = false;
    try {
      await token.decreaseAllowance(accounts[1], 101, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "was allowed to subtract too much from decreaseAllowance"
    );
  });

  it("approvals: cannot approve 0x0 as a spender ", async () => {
    let threw = false;
    try {
      await token.approve("0x0000000000000000000000000000000000000000", 100, {
        from: accounts[0],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "was allowed to approve 0x0 as a spender");
  });

  it("transferFrom: _transfer from zero address not allowed.", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    let threw = false;
    try {
      await token.transferFrom(
        "0x0000000000000000000000000000000000000000",
        accounts[2],
        20,
        { from: accounts[1] }
      );
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "was allowed to _transfer from zero address");
  });

  it("transferFrom: _transfer to zero address not allowed.", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    let threw = false;
    try {
      await token.transferFrom(
        accounts[2],
        "0x0000000000000000000000000000000000000000",
        20,
        { from: accounts[1] }
      );
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "was allowed to _transfer to zero address");
  });

  it("transferFrom: _transfer can not exceed balance of sender address.", async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    let threw = false;
    try {
      await token.transferFrom(accounts[2], accounts[0], 20, {
        from: accounts[1],
      });
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "was allowed to _transfer more than sender's balance"
    );
  });

  it("events: should fire Transfer event properly", async () => {
    const res = await token.transfer(accounts[1], "2666", {
      from: accounts[0],
    });
    const transferLog = res.logs.find(
      (element) =>
        element.event.match("Transfer") && element.address.match(token.address)
    );
    assert.strictEqual(transferLog.args.from, accounts[0]);
    // L2 ETH transfer also emits a transfer event
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.strictEqual(transferLog.args.value.toString(), "2666");
  });

  it("events: should fire Transfer event normally on a zero transfer", async () => {
    const res = await token.transfer(accounts[1], "0", { from: accounts[0] });
    const transferLog = res.logs.find(
      (element) =>
        element.event.match("Transfer") && element.address.match(token.address)
    );
    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.strictEqual(transferLog.args.value.toString(), "0");
  });

  it("events: should fire Approval event properly", async () => {
    const res = await token.approve(accounts[1], "2666", { from: accounts[0] });
    const approvalLog = res.logs.find((element) =>
      element.event.match("Approval")
    );
    assert.strictEqual(approvalLog.args.owner, accounts[0]);
    assert.strictEqual(approvalLog.args.spender, accounts[1]);
    assert.strictEqual(approvalLog.args.value.toString(), "2666");
  });

  it("Locking: Tokens Can be Locked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
    const lockedAmount = await token.baseTokensLocked.call(accounts[0]);
    assert.strictEqual(lockedAmount.toNumber(), 5000);

    const unlockEpoch = await token.unlockEpoch.call(accounts[0]);
    assert.strictEqual(unlockEpoch.toNumber(), 1000);

    const unlockedPerEpoch = await token.unlockedPerEpoch.call(accounts[0]);
    assert.strictEqual(unlockedPerEpoch.toNumber(), 500);

    blockNum = await web3.eth.getBlockNumber();
    block = await web3.eth.getBlock(blockNum);
    const timestamp = block.timestamp;

    const lockTime = await token.lockTime.call(accounts[0]);
    assert.strictEqual(lockTime.toNumber(), timestamp);
  });

  it("Locking: Partial unlocking between unlockEpochs", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(250);
    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);
    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 250; testing token.balanceUnlocked at time " +
          timestamp.toString()
      );
    }
    assert.strictEqual(balanceUnlocked.toNumber(), 5125);
  });

  it("Locking: Cannot create new lock while one exists", async () => {
    let threw = false;
    try {
      await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
      //should fail on the second one!
      await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("Locking: Account must have enough tokens to lock", async () => {
    let threw = false;
    try {
      await token.newTokenLock("10001", 1000, 500, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("Locking: Token Unlock Epoch must be greater than zero", async () => {
    let threw = false;
    try {
      await token.newTokenLock("5000", 0, 500, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("Locking: Amount unlocked per epoch is less than amount locked ", async () => {
    let threw = false;
    try {
      await token.newTokenLock("5000", 1000, 5001, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });

  it("Locking: Amount unlocked per epoch is greater than zero", async () => {
    let threw = false;
    try {
      await token.newTokenLock("5000", 1000, 0, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true);
  });
  it("Locking: Computes correct tokens locked for Account that has never locked tokens", async () => {
    const lockedAmount = await token.balanceLocked.call(accounts[0]);
    assert.strictEqual(lockedAmount.toNumber(), 0);
  });

  it("Locking: Computes correct tokens unlocked for Account that has never locked tokens", async () => {
    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);

    assert.strictEqual(balanceUnlocked.toNumber(), 10000);
  });

  it("Locking: Computes correct tokens locked over time", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    const balanceLocked = await token.balanceLocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 1000; testing token.balanceLocked at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceLocked.toNumber(), 4500);

    await helper.advanceTimeAndBlock(9000);

    const balanceLocked1 = await token.balanceLocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 9000; testing token.balanceLocked at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceLocked1.toNumber(), 0);

    await helper.advanceTimeAndBlock(2000);

    const balanceLocked2 = await token.balanceLocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 2000; testing token.balanceLocked at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceLocked2.toNumber(), 0);
  });

  it("Locking: Computes correct tokens un-locked over time", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 1000; testing token.balanceUnlocked at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceUnlocked.toNumber(), 5500);

    await helper.advanceTimeAndBlock(9000);

    const balanceUnlocked1 = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      console.log(
        "advanced time by 9000; testing token.balanceUnlocked at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceUnlocked1.toNumber(), 10000);
  });

  it("Locking: unlocked tokens can be transferred", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });
    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await token.transfer(accounts[1], 5000, { from: accounts[0] });
    const balance1 = await token.balanceOf.call(accounts[1]);
    assert.strictEqual(
      5000,
      balance1.toNumber(),
      "failed to send unlocked tokens (5000)"
    );

    await helper.advanceTimeAndBlock(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; testing token.transfer at time " +
          timestamp.toString()
      );
    }

    await token.transfer(accounts[1], 500, { from: accounts[0] });

    const balance2 = await token.balanceOf.call(accounts[1]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log("after token.transfer(...); time is " + timestamp.toString());
    }

    assert.strictEqual(
      5500,
      balance2.toNumber(),
      "failed to send unlocked tokens(500)"
    );
  });

  it("Locking: locked tokens cannot be transferred", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    let threw = false;
    try {
      await token.transfer(accounts[1], 5001, { from: accounts[0] });
    } catch (e) {
      threw = true;
    }

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "after failed(?) token.transfer(...); time is " + timestamp.toString()
      );
    }

    assert.equal(threw, true, "ERROR: locked tokens were sent.. somehow!");

    await token.transfer(accounts[1], 5000, { from: accounts[0] });
    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "after successful token.transfer(...); time is " + timestamp.toString()
      );
    }

    let threw2 = false;
    try {
      await token.transfer(accounts[1], 1, { from: accounts[0] });
    } catch (e) {
      threw2 = true;
    }

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "after failed(?) token.transfer(...); time is " + timestamp.toString()
      );
    }

    assert.equal(threw2, true, "was able to send a locked token");
  });

  it("Locking: expired timelocks can be cleared", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(10000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 10000; testing token.clearLock() at time " +
          timestamp.toString()
      );
    }

    await token.clearLock();

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log("after token.clearLock(); time is " + timestamp.toString());
    }

    const lockedAmount = await token.baseTokensLocked.call(accounts[0]);
    assert.strictEqual(lockedAmount.toNumber(), 0);

    const unlockEpoch = await token.unlockEpoch.call(accounts[0]);
    assert.strictEqual(unlockEpoch.toNumber(), 0);

    const unlockedPerEpoch = await token.unlockedPerEpoch.call(accounts[0]);
    assert.strictEqual(unlockedPerEpoch.toNumber(), 0);

    const lockTime2 = await token.lockTime.call(accounts[0]);
    assert.strictEqual(lockTime2.toNumber(), 0);
  });

  it("Locking: clearing timelock fails if tokens are locked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(9500);

    let threw = false;
    try {
      await token.clearLock();
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "ERROR: cleared an active lock");
  });

  it("Locking: reduce tokens unlocked each epoch by amount", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; will call decreaseUnlockAmount(499) next " +
          timestamp.toString()
      );
    }

    await token.decreaseUnlockAmount(499);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "time after decreaseUnlockAmount(499) " + timestamp.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 10000; testing token.balanceUnlocked() at time " +
          timestamp.toString()
      );
    }

    assert.strictEqual(balanceUnlocked.toNumber(), 5501);
  });

  it("Locking: reducing tokens unlocked each epoch possible only if tokens locked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(10000);

    let threw = false;
    try {
      await token.decreaseUnlockAmount(499);
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "ERROR: reducing tokens unlocked each epoch possible without tokens locked"
    );
  });

  it("Locking: tokens unlocked amount cannot be reduced *by* zero", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(1000);

    let threw = false;
    try {
      await token.decreaseUnlockAmount(0);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "ERROR: zero amount was permitted");
  });

  it("Locking: tokens unlocked amount cannot be reduced *to* zero", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(1000);

    let threw = false;
    try {
      await token.decreaseUnlockAmount(500);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "ERROR: zero amount was permitted");
  });

  it("Locking: token unlock period can be increased", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; will call increaseUnlockTime(1000) next " +
          timestamp.toString()
      );
    }

    await token.increaseUnlockTime(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "time after increaseUnlockTime(1000) " + timestamp.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; testing balanceUnlocked " + timestamp.toString()
      );
    }

    assert.strictEqual(
      balanceUnlocked.toNumber(),
      5750,
      "time interval doubled, half the tokens should have unlocked this epoch"
    );

    await helper.advanceTimeAndBlock(1000);

    const balanceUnlocked2 = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; testing balanceUnlocked " + timestamp.toString()
      );
    }

    assert.strictEqual(balanceUnlocked2.toNumber(), 6000);
  });

  it("Locking: increasing unlock period possible only if tokens are locked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(10000);

    let threw = false;
    try {
      await token.increaseUnlockTime(1000);
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "ERROR: increasing unlocked period possible without tokens locked"
    );
  });

  it("Locking: unlock period cannot be increased *by* zero", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(1000);

    let threw = false;
    try {
      await token.increaseUnlockTime(0);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "ERROR: zero amount was permitted");
  });

  it("Locking: lock up more tokens by specified addedValue", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "lock created at block.timestamp " +
          timestamp.toString() +
          " according to contract " +
          lockTime.toString()
      );
    }

    await helper.advanceTimeAndBlock(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; will call increaseTokensLocked(1000) next " +
          timestamp.toString()
      );
    }

    await token.increaseTokensLocked(1000);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "time after increaseTokensLocked(1000), testing token.balanceUnlocked() " +
          timestamp.toString()
      );
    }

    const balanceUnlocked = await token.balanceUnlocked.call(accounts[0]);
    assert.strictEqual(balanceUnlocked.toNumber(), 4500);

    await helper.advanceTimeAndBlock(1000);

    const balanceUnlocked1 = await token.balanceUnlocked.call(accounts[0]);

    if (verbose) {
      blockNum = await web3.eth.getBlockNumber();
      block = await web3.eth.getBlock(blockNum);
      const timestamp = block.timestamp;
      const lockTime = await token.lockTime.call(accounts[0]);
      console.log(
        "advanced time by 1000; testing balanceUnlocked " + timestamp.toString()
      );
    }

    assert.strictEqual(balanceUnlocked1.toNumber(), 5000);
  });

  it("Locking: increasing tokens locked possible only if tokens are already locked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(10000);

    let threw = false;
    try {
      await token.increaseTokensLocked(1000);
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "ERROR: increasing tokens locked each epoch possible without tokens locked"
    );
  });

  it("Locking: cannot increase tokens locked *by* zero", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(1000);

    let threw = false;
    try {
      await token.increaseTokensLocked(0);
    } catch (e) {
      threw = true;
    }
    assert.equal(threw, true, "ERROR: zero amount was permitted");
  });

  it("Locking: when increasing the tokens locked there must be sufficient tokens", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    await helper.advanceTimeAndBlock(1000);

    let threw = false;
    try {
      await token.increaseTokensLocked(6000);
    } catch (e) {
      threw = true;
    }
    assert.equal(
      threw,
      true,
      "ERROR: locking unavailable tokens was permitted"
    );
  });

  it("Locking-events: should fire NewTokenLock event upon new lock", async () => {
    const res = await token.newTokenLock("5000", 1000, 500, {
      from: accounts[0],
    });
    const log = res.logs.find(
      (element) =>
        element.event.match("NewTokenLock") &&
        element.address.match(token.address)
    );
    const lockTime = await token.lockTime.call(accounts[0]);

    assert.strictEqual(log.args.tokenHolder, accounts[0]),
      "address does not match";
    assert.strictEqual(
      log.args.amountLocked.toString(),
      "5000",
      "amount locked does not match"
    );
    assert.strictEqual(
      log.args.time.toString(),
      lockTime.toString(),
      "lockTime does not match"
    );
    assert.strictEqual(
      log.args.unlockPeriod.toString(),
      "1000",
      "unlockPeriod does not match"
    );
    assert.strictEqual(
      log.args.unlockedPerPeriod.toString(),
      "500",
      "unlockedPerPeriod does not match"
    );
  });

  it("Locking-events: should fire UpdateTokenLock event upon decreaseUnlockAmount", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    const res = await token.decreaseUnlockAmount(499);

    const lockTime = await token.lockTime.call(accounts[0]);

    const log = res.logs.find(
      (element) =>
        element.event.match("UpdateTokenLock") &&
        element.address.match(token.address)
    );
    assert.strictEqual(log.args.tokenHolder, accounts[0]),
      "address does not match";
    assert.strictEqual(
      log.args.amountLocked.toString(),
      "5000",
      "amount locked does not match"
    );
    assert.strictEqual(
      log.args.time.toString(),
      lockTime.toString(),
      "lockTime does not match"
    );
    assert.strictEqual(
      log.args.unlockPeriod.toString(),
      "1000",
      "unlockPeriod does not match"
    );
    assert.strictEqual(
      log.args.unlockedPerPeriod.toString(),
      "1",
      "unlockedPerPeriod does not match"
    );
  });

  it("Locking-events: should fire UpdateTokenLock event upon increaseUnlockTime", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    const res = await token.increaseUnlockTime(1);

    const lockTime = await token.lockTime.call(accounts[0]);

    const log = res.logs.find(
      (element) =>
        element.event.match("UpdateTokenLock") &&
        element.address.match(token.address)
    );
    assert.strictEqual(log.args.tokenHolder, accounts[0]),
      "address does not match";
    assert.strictEqual(
      log.args.amountLocked.toString(),
      "5000",
      "amount locked does not match"
    );
    assert.strictEqual(
      log.args.time.toString(),
      lockTime.toString(),
      "lockTime does not match"
    );
    assert.strictEqual(
      log.args.unlockPeriod.toString(),
      "1001",
      "unlockPeriod does not match"
    );
    assert.strictEqual(
      log.args.unlockedPerPeriod.toString(),
      "500",
      "unlockedPerPeriod does not match"
    );
  });

  it("Locking-events: should fire UpdateTokenLock event upon increaseTokensLocked", async () => {
    await token.newTokenLock("5000", 1000, 500, { from: accounts[0] });

    const res = await token.increaseTokensLocked(1);

    const lockTime = await token.lockTime.call(accounts[0]);

    const log = res.logs.find(
      (element) =>
        element.event.match("UpdateTokenLock") &&
        element.address.match(token.address)
    );
    assert.strictEqual(log.args.tokenHolder, accounts[0]),
      "address does not match";
    assert.strictEqual(
      log.args.amountLocked.toString(),
      "5001",
      "amount locked does not match"
    );
    assert.strictEqual(
      log.args.time.toString(),
      lockTime.toString(),
      "lockTime does not match"
    );
    assert.strictEqual(
      log.args.unlockPeriod.toString(),
      "1000",
      "unlockPeriod does not match"
    );
    assert.strictEqual(
      log.args.unlockedPerPeriod.toString(),
      "500",
      "unlockedPerPeriod does not match"
    );
  });
});
