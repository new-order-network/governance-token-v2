// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.3;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
@title TimelockToken contract - implements an ERC20 governance token with built-in locking capabilities to implement a vesting schedule with a vesting cliff.

Based on 
https://github.com/gnosis/disbursement-contracts/blob/master/contracts/Disbursement.sol
 +
https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
**/

interface ILOCKABLETOKEN{
    /**
     * @dev Returns the amount of tokens that are unlocked i.e. transferrable by `who`
     *
     */
    function balanceUnlocked(address who) external view returns (uint256 amount);
    /**
     * @dev Returns the amount of tokens that are locked and not transferrable by `who`
     *
     */
    function balanceLocked(address who) external view returns (uint256 amount);

    /**
     * @dev Emitted when the token lockup is initialized  
     * `tokenHolder` is the address the lock pertains to
     *  `amountLocked` is the amount of tokens locked 
     *  `vestTime` unix time when tokens will start vesting
     *  `cliffTime` unix time before which locked tokens are not transferrable
     *  `period` is the time interval over which tokens vest
     */
    event  NewTokenLock(address tokenHolder, uint256 amountLocked, uint256 vestTime, uint256 cliffTime, uint256 period);

} 


contract TimeLockToken is ERC20, ILOCKABLETOKEN{

     /*
     *  Events
     */

    /*
     *  Storage
     */
    
    //token locking state variables
    mapping(address => uint256) public disbursementPeriod;
    mapping(address => uint256) public vestTime;
    mapping(address => uint256) public cliffTime;
    mapping(address => uint256) public timelockedTokens;

    /*
     *  Public functions
     */

    constructor(string memory name_, string memory symbol_, uint256 amount_, address deployer_) ERC20(name_, symbol_){
        _mint(deployer_, amount_);
    }

    /* 
     @dev function to lock tokens, only if there are no tokens currently locked
     @param timelockedTokens_ number of tokens to lock up
     @param `vestTime_` unix time when tokens will start vesting
     @param `cliffTime_` unix time before which locked tokens are not transferrable
     @param `disbursementPeriod_` is the time interval over which tokens vest
     */
    function newTimeLock(uint256 timelockedTokens_, uint256 vestTime_, uint256 cliffTime_, uint256 disbursementPeriod_)
        public
    {
        require(timelockedTokens_ > 0, "Cannot timelock 0 tokens");
        require(timelockedTokens_ <= balanceOf(msg.sender), "Cannot timelock more tokens than current balance");
        require(balanceLocked(msg.sender) == 0, "Cannot timelock additional tokens while tokens already locked");
        require(disbursementPeriod_ > 0, "Cannot have disbursement period of 0");
        require(vestTime_ > block.timestamp, "vesting start must be in the future");
        require(cliffTime_ >= vestTime_, "cliff must be at same time as vesting starts (or later)");

        disbursementPeriod[msg.sender] = disbursementPeriod_;
        vestTime[msg.sender] = vestTime_;
        cliffTime[msg.sender] = cliffTime_;
        timelockedTokens[msg.sender] = timelockedTokens_;
        emit NewTokenLock(msg.sender, timelockedTokens_, vestTime_, cliffTime_, disbursementPeriod_);
    }

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        uint maxTokens = calcMaxTransferrable(from);
        if (from != address(0x0) && amount > maxTokens){
          revert("amount exceeds available unlocked tokens");
        }
    }

   
    /// @dev Calculates the maximum amount of transferrable tokens for address `who`
    /// @return Number of transferrable tokens 
    function calcMaxTransferrable(address who)
        public
        view
        returns (uint256)
    {
        if(timelockedTokens[who] == 0){
            return balanceOf(who);
        }
        uint256 maxTokens;
        if( vestTime[who] > block.timestamp || cliffTime[who] > block.timestamp){
            maxTokens = 0;
        } else {
            maxTokens = timelockedTokens[who] * (block.timestamp - vestTime[who]) / disbursementPeriod[who];
        }
        if (timelockedTokens[who] < maxTokens){
          return balanceOf(who);
        }
        return balanceOf(who) + maxTokens - timelockedTokens[who];
    }
    
    /// @dev Calculates the amount of locked tokens for address `who`
    /// @return amount of locked tokens 
    function balanceLocked(address who) 
        public 
        virtual 
        override 
        view 
        returns (uint256 amount){

        if(timelockedTokens[who] == 0){
            return 0;
        }
        if( vestTime[who] > block.timestamp || cliffTime[who] > block.timestamp){
            return timelockedTokens[who];
        }
        uint256 maxTokens = timelockedTokens[who] * (block.timestamp - vestTime[who]) / disbursementPeriod[who];
        if(maxTokens >= timelockedTokens[who]){
            return 0;
        }
        return timelockedTokens[who] - maxTokens;

    }
    /// @dev Calculates the maximum amount of transferrable tokens for address `who`. Alias for calcMaxTransferrable for backwards compatibility.
    /// @return amount of transferrable tokens 
    function balanceUnlocked(address who) public view virtual override returns (uint256 amount){
        return calcMaxTransferrable(who);
    }

}