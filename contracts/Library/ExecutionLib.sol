pragma solidity 0.4.24;

/**
 * @title ExecutionLib
 * @dev Contains the logic for executing a scheduled transaction.
 */
library ExecutionLib {

    struct ExecutionData {
        address toAddress;                  /// The destination of the transaction.
        bytes callData;                     /// The bytecode that will be sent with the transaction.
        uint callValue;                     /// The marley value that will be sent with the transaction.
        uint callSmoke;                       /// The amount of smoke to be sent with the transaction.
        uint smokePrice;                      /// The smokePrice that should be set for the transaction.
    }

    /**
     * @dev Send the transaction according to the parameters outlined in ExecutionData.
     * @param self The ExecutionData object.
     */
    function sendTransaction(ExecutionData storage self)
        internal returns (bool)
    {
        /// Should never actually reach this require check, but here in case.
        require(self.smokePrice <= tx.smokeprice);
        /* solium-disable security/no-call-value */
        return self.toAddress.call.value(self.callValue).smoke(self.callSmoke)(self.callData);
    }


    /**
     * Returns the maximum possible smoke consumption that a transaction request
     * may consume.  The EXTRA_SMOKE value represents the overhead involved in
     * request execution.
     */
    function CALL_SMOKE_CEILING(uint EXTRA_SMOKE) 
        internal view returns (uint)
    {
        return block.smokelimit - EXTRA_SMOKE;
    }

    /*
     * @dev Validation: ensure that the callSmoke is not above the total possible smoke
     * for a call.
     */
    function validateCallSmoke(uint callSmoke, uint EXTRA_SMOKE)
        internal view returns (bool)
    {
        return callSmoke < CALL_SMOKE_CEILING(EXTRA_SMOKE);
    }

    /*
     * @dev Validation: ensure that the toAddress is not set to the empty address.
     */
    function validateToAddress(address toAddress)
        internal pure returns (bool)
    {
        return toAddress != 0x0;
    }
}
