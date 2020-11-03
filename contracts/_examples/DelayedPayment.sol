pragma solidity 0.4.24;

import "contracts/Interface/SchedulerInterface.sol";

/// Example of using the Scheduler from a smart contract to delay a payment.
contract DelayedPayment {

    SchedulerInterface public scheduler;
    
    address recipient;
    address owner;
    address public payment;

    uint lockedUntil;
    uint value;
    uint twentyGmarley = 20000000000 marley;

    constructor(
        address _scheduler,
        uint    _numBlocks,
        address _recipient,
        uint _value
    )  public payable {
        scheduler = SchedulerInterface(_scheduler);
        lockedUntil = block.number + _numBlocks;
        recipient = _recipient;
        owner = msg.sender;
        value = _value;
   
        uint endowment = scheduler.computeEndowment(
            twentyGmarley,
            twentyGmarley,
            200000,
            0,
            twentyGmarley
        );

        payment = scheduler.schedule.value(endowment)( // 0.1 420coin is to pay for smoke, bounty and fee
            this,                   // send to self
            "",                     // and trigger fallback function
            [
                200000,             // The amount of smoke to be sent with the transaction.
                0,                  // The amount of marley to be sent.
                255,                // The size of the execution window.
                lockedUntil,        // The start of the execution window.
                twentyGmarley,    // The smokeprice for the transaction (aka 20 gmarley)
                twentyGmarley,    // The fee included in the transaction.
                twentyGmarley,         // The bounty that awards the executor of the transaction.
                twentyGmarley * 2     // The required amount of marley the claimer must send as deposit.
            ]
        );

        assert(address(this).balance >= value);
    }

    function () public payable {
        if (msg.value > 0) { //this handles recieving remaining funds sent while scheduling (0.1 420coin)
            return;
        } else if (address(this).balance > 0) {
            payout();
        } else {
            revert();
        }
    }

    function payout()
        public returns (bool)
    {
        require(block.number >= lockedUntil);
        
        recipient.transfer(value);
        return true;
    }

    function collectRemaining()
        public returns (bool) 
    {
        owner.transfer(address(this).balance);
    }
}