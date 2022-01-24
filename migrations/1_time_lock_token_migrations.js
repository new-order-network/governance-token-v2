const TimeLockToken = artifacts.require("TimeLockToken");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(TimeLockToken, "New Order", "NEWO", 10000, accounts[9]);
};
