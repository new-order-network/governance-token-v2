const GovernanceToken = artifacts.require("GovernanceToken");

module.exports = function (deployer) {
  deployer.deploy(GovernanceToken);
};
