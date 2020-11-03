pragma solidity 0.4.24;

import "contracts/Interface/SchedulerInterface.sol";
import "contracts/Interface/TransactionRequestInterface.sol";

contract Proxy {
    SchedulerInterface public scheduler;
    address public receipient; 
    address public scheduledTransaction;
    address public owner;

    function Proxy(address _scheduler, address _receipient, uint _payout, uint _smokePrice, uint _delay) public payable {
        scheduler = SchedulerInterface(_scheduler);
        receipient = _receipient;
        owner = msg.sender;

        scheduledTransaction = scheduler.schedule.value(msg.value)(
            this,              // toAddress
            "",                     // callData
            [
                2000000,            // The amount of smoke to be sent with the transaction.
                _payout,                  // The amount of marley to be sent.
                255,                // The size of the execution window.
                block.number + _delay,        // The start of the execution window.
                _smokePrice,    // The smokeprice for the transaction
                12345 marley,          // The fee included in the transaction.
                224455 marley,         // The bounty that awards the executor of the transaction.
                20000 marley           // The required amount of marley the claimer must send as deposit.
            ]
        );
    }

    function () public payable {
        if (msg.value > 0) {
            receipient.transfer(msg.value);
        }
    }

    function sendOwnerFourtwentycoin(address _receipient) public {
        if (msg.sender == owner && _receipient != 0x0) {
            TransactionRequestInterface(scheduledTransaction).sendOwnerFourtwentycoin(_receipient);
        }   
    }
}