require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

// Contracts
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequestCore = artifacts.require("./TransactionRequestCore.sol")

const { waitUntilBlock } = require("@digix/tempo")(web3)

// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, wasAborted } = require("../dataHelpers.js")

contract("claim deposit", async (accounts) => {
  let txRecorder
  let txRequest

  const smokePrice = config.web3.utils.toMarley("24", "gmarley")
  const requiredDeposit = config.web3.utils.toMarley("40", "kmarley")

  // TransactionRequest constants
  const claimWindowSize = 25 // blocks
  const freezePeriod = 5 // blocks
  const reservedWindowSize = 10 // blocks
  const executionWindow = 15 // blocks

  const fee = 12345
  const bounty = config.web3.utils.toMarley("232", "willie")

  beforeEach(async () => {
    txRecorder = await TransactionRecorder.new()
    expect(txRecorder.address).to.exist

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
        fee,
        bounty,
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        1, // temporalUnit = 1, aka blocks
        executionWindow,
        windowStart,
        43324, // callSmoke
        0, // callValue
        smokePrice,
        requiredDeposit,
      ],
      "some-call-data-could-be-anything",
      { value: config.web3.utils.toMarley("100", "willie") }
    )
  })

  it("tests claim deposit CAN be refunded if after execution window and was not executed", async () => {
    const requestData = await RequestData.from(txRequest)

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, claimAt)

    const balBeforeClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    const claimTx = await txRequest.claim({
      from: accounts[9],
      value: 2 * requestData.paymentData.bounty,
    })
    expect(claimTx.receipt).to.exist

    const balAfterClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(accounts[9])

    expect(parseInt(balBeforeClaim, 10)).to.be.above(parseInt(balAfterClaim, 10))

    expect(requestData.meta.isCancelled).to.be.false

    // Now we wait until after the execution period to cancel.
    const cancelAt = requestData.schedule.windowStart + requestData.schedule.windowSize + 10

    await waitUntilBlock(0, cancelAt)

    const cancelTx = await txRequest.cancel({
      from: accounts[0],
    })
    expect(cancelTx.receipt).to.exist

    await requestData.refresh()

    expect(requestData.meta.isCancelled).to.be.true

    const balAfterCancel = await config.web3.fourtwenty.getBalance(accounts[9])

    expect(parseInt(balAfterCancel, 10)).to.be.above(parseInt(balAfterClaim, 10))
  })

  it("tests claim deposit CAN be refunded if after execution window and was not executed", async () => {
    const requestData = await RequestData.from(txRequest)

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, claimAt)

    const balBeforeClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    const claimTx = await txRequest.claim({
      from: accounts[9],
      value: 2 * requestData.paymentData.bounty,
    })
    expect(claimTx.receipt).to.exist

    const balAfterClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(accounts[9])

    expect(parseInt(balBeforeClaim, 10)).to.be.above(parseInt(balAfterClaim, 10))

    expect(requestData.meta.isCancelled).to.be.false

    // Now we wait until after the execution period to cancel.
    const refundAt = requestData.schedule.windowStart + requestData.schedule.windowSize + 10

    await waitUntilBlock(0, refundAt)

    await txRequest.refundClaimDeposit({
      from: accounts[6],
      smoke: 3000000,
    })

    const balAfterRefund = await config.web3.fourtwenty.getBalance(accounts[9])

    expect(parseInt(balAfterRefund, 10)).to.be.above(parseInt(balAfterClaim, 10))

    const cancelTx = await txRequest.cancel({
      from: accounts[0],
    })
    expect(cancelTx.receipt).to.exist

    await requestData.refresh()

    expect(requestData.meta.isCancelled).to.be.true

    const balAfterCancel = await config.web3.fourtwenty.getBalance(accounts[9])

    expect(parseInt(balAfterCancel, 10)).to.equal(parseInt(balAfterRefund, 10))
  })

  it("tests claim deposit CANNOT be refunded if executed", async () => {
    const requestData = await RequestData.from(txRequest)

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, claimAt)

    const balBeforeClaim = await config.web3.fourtwenty.getBalance(accounts[7])

    const claimTx = await txRequest.claim({
      from: accounts[7],
      value: 2 * requestData.paymentData.bounty,
    })
    expect(claimTx.receipt).to.exist

    const balAfterClaim = await config.web3.fourtwenty.getBalance(accounts[7])

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(accounts[7])

    expect(parseInt(balBeforeClaim, 10)).to.be.above(parseInt(balAfterClaim, 10))

    // Now we execute from a different account
    const executeAt = requestData.schedule.windowStart + requestData.schedule.reservedWindowSize

    await waitUntilBlock(0, executeAt)

    const executeTx = await txRequest.execute({
      from: accounts[2],
      smoke: 3000000,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    expect(wasAborted(executeTx)).to.be.false

    const balAfterExecute = await config.web3.fourtwenty.getBalance(accounts[7])

    expect(balAfterExecute).to.equal(balAfterClaim)

    // Wait until after the window and try to cancel
    await waitUntilBlock(0, (await config.web3.fourtwenty.getBlockNumber()) + 50)

    await txRequest
      .cancel({
        from: accounts[0],
      })
      .should.be.rejectedWith("VM Exception while processing transaction: revert")

    const balAfterAttemptedCancel = await config.web3.fourtwenty.getBalance(accounts[7])

    expect(balAfterClaim)
      .to.equal(balAfterAttemptedCancel)
      .to.equal(balAfterExecute)
  })

  it("tests claim deposit CANNOT be refunded if before or during execution window", async () => {
    const requestData = await RequestData.from(txRequest)

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above(await config.web3.fourtwenty.getBlockNumber())

    await waitUntilBlock(0, claimAt)

    const balBeforeClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    const claimTx = await txRequest.claim({
      from: accounts[9],
      value: 2 * requestData.paymentData.bounty,
    })
    expect(claimTx.receipt).to.exist

    const balAfterClaim = await config.web3.fourtwenty.getBalance(accounts[9])

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(accounts[9])

    expect(parseInt(balBeforeClaim, 10)).to.be.above(parseInt(balAfterClaim, 10))

    expect(requestData.meta.isCancelled).to.be.false

    const cancelAt = claimAt + requestData.schedule.claimWindowSize + 2
    await waitUntilBlock(0, cancelAt)

    await txRequest
      .cancel({
        from: accounts[0],
      })
      .should.be.rejectedWith("VM Exception while processing transaction: revert")

    await requestData.refresh()

    expect(requestData.meta.isCancelled).to.be.false

    const balAfterAttemptedCancel = await config.web3.fourtwenty.getBalance(accounts[9])

    expect(balAfterClaim).to.equal(balAfterAttemptedCancel)
  })
})
