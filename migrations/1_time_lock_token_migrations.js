const TimeLockToken = artifacts.require("TimeLockToken");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(TimeLockToken, "New Order (v2)", "NEWO", 10000, accounts[0]);
};
