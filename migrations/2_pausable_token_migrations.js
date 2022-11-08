const GovernanceTokenPausable = artifacts.require("GovernanceTokenPausable");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(GovernanceTokenPausable, "New Order", "NEWO", 10000, accounts[9]);
};
