// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.3;
import "@openzeppelin/contracts@4.3.2/token/ERC20/ERC20.sol";

/**
@title TimelockToken contract - allows a token unlock over time
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
     * @dev Emitted when the token lock is initialized  
     * `tokenHolder` is the address the lock pertains to
     *  `amountLocked` is the amount of tokens locked 
     *  `startTime` unix time when tokens will start vesting (i.e. cliff)
     *  `unlockPeriod` is the time interval at which tokens become unlockedPerPeriod
     */
    event  NewTokenLock(address tokenHolder, uint256 amountLocked, uint256 startTime, uint256 unlockPeriod);

} 

//TODO: define interface for querying timelocked tokens
//make compatible with old token
//add events
contract TimeLockToken is ERC20, ILOCKABLETOKEN{

     /*
     *  Events
     */
    //TODO: Events

    /*
     *  Storage
     */
    
    //token locking state variables
    mapping(address => uint256) public disbursementPeriod;
    mapping(address => uint256) public startDate;
    mapping(address => uint256) public timelockedTokens;
    /*
     *  Public functions
     */

    constructor(string memory name_, string memory symbol_, uint256 amount_, address deployer_) ERC20(name_, symbol_){
        _mint(deployer_, amount_);
    }

    /// @dev function to lock tokens, only if there are no tokens currently locked
    /// @param timelockedTokens_ number of tokens to lock up
    /// @param startDate_ unix time when tokens will start vesting (i.e. cliff)
    /// @param disbursementPeriod_ Vesting period in seconds
    function newTimeLock(uint256 timelockedTokens_, uint256 startDate_, uint256 disbursementPeriod_)
        public
    {
        require(timelockedTokens_ > 0, "Cannot timelock 0 tokens");
        require(timelockedTokens_ <= balanceOf(msg.sender), "Cannot timelock more tokens than current balance");
        require(balanceLocked(msg.sender) == 0, "Cannot timelock additional tokens while tokens already locked");
        require(disbursementPeriod_ > 0, "Cannot have disbursement period of 0");
        require(startDate_ > block.timestamp, "Start Date must be in the future");
        disbursementPeriod[msg.sender] = disbursementPeriod_;
        startDate[msg.sender] = startDate_;
        timelockedTokens[msg.sender] = timelockedTokens_;
        emit NewTokenLock(msg.sender, timelockedTokens_, startDate_, disbursementPeriod_);
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
        uint maxTokens = calcMaxTransferrable(msg.sender);
        if (from != address(0x0) && amount > maxTokens){
          revert("Withdraw amount exceeds available unlocked tokens");
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
        if( startDate[who] > block.timestamp){
            maxTokens = 0;
        } else {
            maxTokens = timelockedTokens[who] * (block.timestamp - startDate[who]) / disbursementPeriod[who];
        }
        if (timelockedTokens[who] < maxTokens){
          return balanceOf(who);
        }
        return balanceOf(who) - timelockedTokens[who] + maxTokens;
    }

    function balanceLocked(address who) 
        public 
        virtual 
        override 
        view 
        returns (uint256 amount){

        if(timelockedTokens[who] == 0){
            return 0;
        }
        if(startDate[who] > block.timestamp){
            return timelockedTokens[who];
        }
        uint256 maxTokens = timelockedTokens[who] * (block.timestamp - startDate[who]) / disbursementPeriod[who];
        if(maxTokens >= timelockedTokens[who]){
            return 0;
        }
        return timelockedTokens[who] - maxTokens;

    }

    function balanceUnlocked(address who) public view virtual override returns (uint256 amount){
        return calcMaxTransferrable(who);
    }

}
