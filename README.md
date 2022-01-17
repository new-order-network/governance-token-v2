# GovernanceTokenV2
version 2 of the governance token implementing a vesting cliff in locked tokens.

This contract implements an ERC20 governance token with built-in locking capabilities to implement a vesting schedule with a vesting cliff.

In addition to the standard ERC20 functions, this contract adds the following functionality:

## newTimeLock
This function is used to lock tokens, with a precondition that the calling address has no tokens currently locked
It expects the following arguments:
timelockedTokens_ - the number of tokens to lock up
vestTime_ - unix time when tokens will start vesting
cliffTime_ - unix time before which locked tokens are not transferrable
disbursementPeriod_ -  is the time interval over which tokens vest

## calcMaxTransferrable
Calculates the maximum amount of transferrable tokens for address `who`
Returns the number of transferrable tokens 

## balanceUnlocked
An alias for calcMaxTransferrable
Returns the amount of tokens that are unlocked i.e. transferrable by `who`

## balanceLocked
Returns the amount of tokens that are locked and not transferrable by `who`

## Event NewTokenLock(address tokenHolder, uint256 amountLocked, uint256 vestTime, uint256 cliffTime, uint256 period)
Emitted when a token lockup is initialized  
tokenHolder` is the address the lock pertains to
amountLocked is the amount of tokens locked 
startTime unix time when tokens will start vesting
cliffTime unix time before which locked tokens are not transferrable
period is the time interval over which tokens vest
