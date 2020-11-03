require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

// Contracts
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequestCore = artifacts.require("./TransactionRequestCore.sol")

const { waitUntilBlock } = require("@digix/tempo")(web3)

// Bring in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, parseAbortData, wasAborted } = require("../dataHelpers.js")

contract("tests execution rejected if cancelled", async (accounts) => {
  it("will reject the execution if it was cancelled", async () => {
    const Owner = accounts[0]

    const smokePrice = config.web3.utils.toMarley("66", "gmarley")
    const requiredDeposit = config.web3.utils.toMarley("66", "kmarley")

    // TransactionRequest constants
    const claimWindowSize = 25 // blocks
    const freezePeriod = 5 // blocks
    const reservedWindowSize = 10 // blocks
    const executionWindow = 10 // blocks

    const curBlockNum = await config.web3.fourtwenty.getBlockNumber()
    const windowStart = curBlockNum + 38

    const txRecorder = await TransactionRecorder.new()

    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        Owner, // createdBy
        Owner, // owner
        accounts[1], // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        0, // fee
        0, // bounty
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        1, // temporalUnit = 1, aka blocks
        executionWindow,
        windowStart,
        2000000, // callSmoke
        0, // callValue
        smokePrice,
        requiredDeposit,
      ],
      "some-call-data-could-be-anything",
      { value: config.web3.utils.toMarley("1") }
    )
    const requestData = await RequestData.from(txRequest)

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    expect(requestData.meta.isCancelled).to.be.false

    const cancelTx = await txRequest.cancel({ from: Owner })
    expect(cancelTx.receipt).to.exist

    await requestData.refresh()

    expect(requestData.meta.isCancelled).to.be.true

    await waitUntilBlock(0, windowStart)

    const executeTx = await txRequest.execute({
      smoke: 3000000,
      smokePrice,
    })

    await requestData.refresh()

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    expect(wasAborted(executeTx)).to.be.true

    expect(parseAbortData(executeTx).find(reason => reason === "WasCancelled")).to.exist
  })
})
