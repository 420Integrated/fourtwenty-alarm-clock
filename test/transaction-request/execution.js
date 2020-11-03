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

contract("Execution", async (accounts) => {
  const smokePrice = config.web3.utils.toMarley("66", "gmarley")
  const requiredDeposit = config.web3.utils.toMarley("66", "kmarley")

  let txRequest
  let txRecorder

  beforeEach(async () => {
    txRecorder = await TransactionRecorder.new()
    expect(txRecorder.address).to.exist

    // TransactionRequest constants
    const claimWindowSize = 25 // blocks
    const freezePeriod = 5 // blocks
    const reservedWindowSize = 10 // blocks
    const executionWindow = 10 // blocks

    const curBlockNum = await config.web3.fourtwenty.getBlockNumber()
    const windowStart = curBlockNum + 38

    txRequest = await TransactionRequestCore.new()
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
    expect(txRequest.address).to.exist
  })

  it("tests execution transaction sent as specified", async () => {
    const requestData = await RequestData.from(txRequest)

    await waitUntilBlock(0, requestData.schedule.windowStart)

    const executeTx = await txRequest.execute({
      smoke: 3000000,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    expect((await txRecorder.wasCalled()) === true).to.be.true
    expect((await txRecorder.lastCaller()) === txRequest.address).to.be.true
    expect((await txRecorder.lastCallValue()).toNumber() === 0).to.be.true
    expect(await txRecorder.lastCallData()).to.exist
    expect(Math.abs((await txRecorder.lastCallSmoke()) - 2000000) < 10000).to.be.true
  })

  // / 2
  it("cannot execute if transaction smokePrice < txnData.smokePrice", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(requestData.schedule.windowStart).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, requestData.schedule.windowStart)

    // / FAILS BECAUSE MISMATCH SMOKEPRICE
    const failedExecuteTx = await txRequest.execute({
      from: accounts[5],
      smoke: 3000000,
      smokePrice: config.web3.utils.toMarley("65", "gmarley"),
    })

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    expect(wasAborted(failedExecuteTx)).to.be.true

    expect(parseAbortData(failedExecuteTx).find(reason => reason === "TooLowSmokePrice")).to.exist
  })

  // 3
  it("CANNOT execute if available smoke is less than txnData.callSmoke + SMOKE_OVERHEAD", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(requestData.schedule.windowStart).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, requestData.schedule.windowStart)

    // The min required smoke is txnData.callSmoke + SMOKE_OVERHEAD (180000)
    const smoke = (requestData.txData.callSmoke + 180000) - 5000
    // console.log(smoke)
    // console.log(smoke + 5000)
    // TODO: Investigate this further ^^^^

    // FAILS BECAUSE NOT SUPPLIED ENOUGH SMOKE
    const failedExecuteTx = await txRequest.execute({
      from: accounts[5],
      smoke,
      smokePrice,
    })

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    expect(wasAborted(failedExecuteTx)).to.be.true

    expect(parseAbortData(failedExecuteTx).find(reason => reason === "InsufficientSmoke")).to.exist
  })
})
