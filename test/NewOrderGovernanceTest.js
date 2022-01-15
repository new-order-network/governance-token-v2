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
    const balance0 = await token.balanceOf(accounts[0]);
    assert.strictEqual(balance0.toNumber(), 10000);

    await token.approve(accounts[1], 100, { from: accounts[0] }); // 100

    const balance2 = await token.balanceOf(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 0, "balance2 not correct");

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
});
