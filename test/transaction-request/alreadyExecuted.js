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

contract("Test already executed", async (accounts) => {
  it("rejects execution if already executed", async () => {
    // Deploy a fresh transactionRecorder
    const txRecorder = await TransactionRecorder.new()
    expect(
      txRecorder.address,
      "transactionRecorder should be fresh for each test"
    ).to.exist

    const MINUTE = 60 // seconds
    const HOUR = 60 * MINUTE
    const DAY = 24 * HOUR

    const smokePrice = config.web3.utils.toMarley("44", "gmarley")
    const requiredDeposit = config.web3.utils.toMarley("44", "kmarley")

    const claimWindowSize = 5 * MINUTE
    const freezePeriod = 2 * MINUTE
    const reservedWindowSize = 1 * MINUTE
    const executionWindow = 2 * MINUTE

    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        accounts[1], // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        0, // fee
        0, // bounty
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        2, // temporalUnit
        executionWindow,
        windowStart,
        2000000, // callSmoke
        0, // callValue
        smokePrice,
        requiredDeposit,
      ],
      "some-call-data-goes-here",
      { value: config.web3.utils.toMarley("1") }
    )

    const requestData = await RequestData.from(txRequest)

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    // / Should claim a transaction before each test
    const secsToWait = requestData.schedule.windowStart - timestamp
    await waitUntilBlock(secsToWait, 0)

    const executeTx = await txRequest.execute({
      from: accounts[1],
      smoke: 3000000,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    const execute = executeTx.logs.find(e => e.event === "Executed")
    expect(execute, "should have fired off the execute log").to.exist

    await requestData.refresh()

    expect(await txRecorder.wasCalled()).to.be.true

    expect(requestData.meta.wasCalled).to.be.true

    // / Now try to duplicate the call
    const executeTx2 = await txRequest.execute({
      from: accounts[1],
      smoke: 3000000,
      smokePrice,
    })

    expect(wasAborted(executeTx2)).to.be.true

    expect(parseAbortData(executeTx2).find(reason => reason === "AlreadyCalled")).to.exist
  })
})
