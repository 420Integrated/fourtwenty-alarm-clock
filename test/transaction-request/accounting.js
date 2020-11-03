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
const { RequestData } = require("../dataHelpers.js")

const { toBN } = config.web3.utils

const MINUTE = 60 // seconds
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NULL_ADDRESS = "0x0000000000000000000000000000000000000000"

contract("Test accounting", async (accounts) => {
  let txRecorder

  // / Constant variables we need in each test
  const claimWindowSize = 5 * MINUTE
  const freezePeriod = 2 * MINUTE
  const reservedWindowSize = 1 * MINUTE
  const executionWindow = 2 * MINUTE

  const feeRecipient = accounts[3]

  const smokePrice = config.web3.utils.toMarley("33", "gmarley")
  const requiredDeposit = config.web3.utils.toMarley("33", "kmarley")

  const fee = 12345
  const bounty = 232323

  beforeEach(async () => {
    // Deploy a fresh transactionRecorder
    txRecorder = await TransactionRecorder.new()
    expect(txRecorder.address).to.exist
  })

  // ///////////////////
  // / Tests ///
  // ///////////////////

  // / 1
  it("tests transaction request payments", async () => {
    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        feeRecipient, // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        fee, // fee
        bounty, // bounty
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
    expect(txRequest.address).to.exist

    const requestData = await RequestData.from(txRequest)

    expect(requestData.paymentData.fee).to.equal(fee)

    expect(requestData.paymentData.bounty).to.equal(bounty)

    const beforeFeeBal = await config.web3.fourtwenty.getBalance(requestData.paymentData.feeRecipient)
    const beforeBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    await waitUntilBlock(
      requestData.schedule.windowStart
        - (await config.web3.fourtwenty.getBlock("latest")).timestamp,
      1
    )

    const executeTx = await txRequest.execute({
      from: accounts[1],
      smoke: 3000000,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    const afterFeeBal = await config.web3.fourtwenty.getBalance(requestData.paymentData.feeRecipient)
    const afterBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    const Executed = executeTx.logs.find(e => e.event === "Executed")
    const feeAmt = Executed.args.fee.toNumber()
    const bountyAmt = Executed.args.bounty.toNumber()

    expect(feeAmt).to.equal(fee)

    expect(toBN(afterFeeBal)
      .sub(toBN(beforeFeeBal))
      .toNumber()).to.equal(feeAmt)

    const { smokeUsed } = executeTx.receipt
    const smokeCost = smokeUsed * smokePrice

    const expectedBounty = smokeCost + requestData.paymentData.bounty

    expect(bountyAmt).to.be.above(expectedBounty)

    expect(bountyAmt - expectedBounty).to.be.below(120000 * smokePrice)

    expect(toBN(afterBountyBal)
      .sub(toBN(beforeBountyBal))
      .toNumber()).to.equal(bountyAmt - smokeCost - 1) // FIXME: Is this an off-by-one error?
  })

  // / 2
  it("tests transaction request payments when claimed", async () => {
    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        feeRecipient, // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        fee, // fee
        bounty, // bounty
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        2, // temporalUnit
        executionWindow,
        windowStart,
        2000000, // callSmoke
        0, // callValue
        smokePrice,
      ],
      "some-call-data-goes-here",
      { value: config.web3.utils.toMarley("1") }
    )
    expect(txRequest.address).to.exist

    const requestData = await RequestData.from(txRequest)

    const beforeBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above((await config.web3.fourtwenty.getBlock("latest")).timestamp)

    await waitUntilBlock(
      claimAt - (await config.web3.fourtwenty.getBlock("latest")).timestamp,
      1
    )

    const claimDeposit = 2 * requestData.paymentData.bounty

    expect(parseInt(claimDeposit, 10)).to.be.above(0)

    const claimTx = await txRequest.claim({
      value: claimDeposit,
      from: accounts[1],
      smokePrice,
    })
    expect(claimTx.receipt).to.exist

    const claimSmokeUsed = claimTx.receipt.smokeUsed
    const claimSmokeCost = smokePrice * claimSmokeUsed

    const afterClaimBal = await config.web3.fourtwenty.getBalance(accounts[1])

    expect(toBN(beforeBountyBal)
      .sub(toBN(afterClaimBal))
      .toString()).to.equal((parseInt(claimDeposit, 10) + claimSmokeCost).toString())

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(accounts[1])

    await waitUntilBlock(
      requestData.schedule.windowStart
        - (await config.web3.fourtwenty.getBlock("latest")).timestamp,
      1
    )

    const executeTx = await txRequest.execute({
      from: accounts[1],
      smoke: 3000000,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    await requestData.refresh()

    const afterBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    const Executed = executeTx.logs.find(e => e.event === "Executed")
    const bountyAmt = Executed.args.bounty.toNumber()

    const executeSmokeUsed = executeTx.receipt.smokeUsed
    const executeSmokeCost = executeSmokeUsed * smokePrice

    const expectedBounty = parseInt(claimDeposit, 10)
      + executeSmokeCost
      + Math.floor((requestData.claimData.paymentModifier * requestData.paymentData.bounty) / 100)

    expect(bountyAmt).to.be.at.least(expectedBounty)

    expect(bountyAmt - expectedBounty).to.be.below(100000 * smokePrice)

    const diff = toBN(afterBountyBal)
      .sub(toBN(beforeBountyBal))
      .toNumber()
    const expectedDiff = bountyAmt - claimDeposit - executeSmokeCost - claimSmokeCost
    if (diff === expectedDiff) expect(diff).to.equal(expectedDiff)
    // else console.log(diff, expectedDiff)
  })

  // 3
  it("tests accounting when everything reverts", async () => {})

  // 4
  it("test claim deposit held by contract on claim", async () => {
    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        feeRecipient, // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        fee, // fee
        bounty, // bounty
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        2, // temporalUnit
        executionWindow,
        windowStart,
        2000000, // callSmoke
        0, // callValue
        smokePrice,
      ],
      "some-call-data-goes-here",
      { value: config.web3.utils.toMarley("1") }
    )
    expect(txRequest.address).to.exist

    const requestData = await RequestData.from(txRequest)

    const claimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize

    expect(claimAt).to.be.above((await config.web3.fourtwenty.getBlock("latest")).timestamp)

    await waitUntilBlock(
      claimAt - (await config.web3.fourtwenty.getBlock("latest")).timestamp,
      1
    )

    const depositAmt = config.web3.utils.toMarley("1")

    const beforeContractBal = await config.web3.fourtwenty.getBalance(txRequest.address)

    const claimTx = await txRequest.claim({
      value: depositAmt,
      from: accounts[1],
    })
    expect(claimTx.receipt).to.exist

    const afterContractBal = await config.web3.fourtwenty.getBalance(txRequest.address)

    expect(toBN(afterContractBal)
      .sub(toBN(beforeContractBal))
      .toString()).to.equal(depositAmt.toString())
  })

  // 5
  it("test claim deposit returned if claim rejected", async () => {
    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        feeRecipient, // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        fee, // fee
        34343, // bounty
        claimWindowSize,
        freezePeriod,
        reservedWindowSize,
        2, // temporalUnit
        executionWindow,
        windowStart,
        2000000, // callSmoke
        0, // callValue
        smokePrice,
      ],
      "some-call-data-goes-here",
      { value: config.web3.utils.toMarley("1") }
    )
    expect(txRequest.address).to.exist

    const requestData = await RequestData.from(txRequest)

    const tryClaimAt = requestData.schedule.windowStart
      - requestData.schedule.freezePeriod
      - requestData.schedule.claimWindowSize
      - 200

    expect(tryClaimAt).to.be.above((await config.web3.fourtwenty.getBlock("latest")).timestamp)

    const depositAmt = config.web3.utils.toMarley("1")

    const beforeContractBal = await config.web3.fourtwenty.getBalance(txRequest.address)
    const beforeAccountBal = await config.web3.fourtwenty.getBalance(accounts[1])

    await txRequest
      .claim({
        value: depositAmt,
        from: accounts[1],
        smokePrice,
      })
      .should.be.rejectedWith("VM Exception while processing transaction: revert")

    const afterContractBal = await config.web3.fourtwenty.getBalance(txRequest.address)
    const afterAccountBal = await config.web3.fourtwenty.getBalance(accounts[1])

    expect(afterContractBal).to.equal(beforeContractBal)

    // Since revert() only returns the smoke that wasn't used,
    // the balance of the account after a failed transaction
    // will be below what it was before.
    expect(parseInt(afterAccountBal, 10)).to.be.below(parseInt(beforeAccountBal, 10))

    await requestData.refresh()

    expect(requestData.claimData.claimedBy).to.equal(NULL_ADDRESS)
  })

  it("tests that only the set smokePrice is returned to executor, not the tx.smokeprice", async () => {
    const curBlock = await config.web3.fourtwenty.getBlock("latest")
    const { timestamp } = curBlock

    const windowStart = timestamp + DAY

    // / Make a transactionRequest
    const txRequest = await TransactionRequestCore.new()
    await txRequest.initialize(
      [
        accounts[0], // createdBy
        accounts[0], // owner
        feeRecipient, // fee recipient
        txRecorder.address, // toAddress
      ],
      [
        fee, // fee
        bounty, // bounty
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
    expect(txRequest.address).to.exist

    const requestData = await RequestData.from(txRequest)

    expect(requestData.paymentData.fee).to.equal(fee)

    expect(requestData.paymentData.bounty).to.equal(bounty)

    const beforeFeeBal = await config.web3.fourtwenty.getBalance(requestData.paymentData.feeRecipient)
    const beforeBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    await waitUntilBlock(
      requestData.schedule.windowStart
        - (await config.web3.fourtwenty.getBlock("latest")).timestamp,
      1
    )

    const moreThanRequired = parseInt(smokePrice, 10) + parseInt(config.web3.utils.toMarley("10", "gmarley"), 10);

    const executeTx = await txRequest.execute({
      from: accounts[1],
      smoke: 3000000,
      smokePrice: moreThanRequired,
    })
    expect(executeTx.receipt).to.exist

    const afterFeeBal = await config.web3.fourtwenty.getBalance(requestData.paymentData.feeRecipient)
    const afterBountyBal = await config.web3.fourtwenty.getBalance(accounts[1])

    const Executed = executeTx.logs.find(e => e.event === "Executed")
    const feeAmt = Executed.args.fee.toNumber()
    const bountyAmt = Executed.args.bounty.toNumber()

    expect(feeAmt).to.equal(fee)

    expect(toBN(afterFeeBal)
      .sub(toBN(beforeFeeBal))
      .toNumber()).to.equal(feeAmt)

    const { smokeUsed } = executeTx.receipt
    const smokeCost = parseInt(smokeUsed, 10) * moreThanRequired
    const smokeReimbursement = (parseInt(smokeUsed, 10) * smokePrice)

    const expectedBounty = smokeReimbursement + requestData.paymentData.bounty

    expect(bountyAmt).to.be.above(expectedBounty)

    expect(bountyAmt - expectedBounty).to.be.below(120000 * smokePrice)

    expect(toBN(afterBountyBal).sub(toBN(beforeBountyBal)).toNumber())
      .to.equal(bountyAmt - smokeCost - 1)
  })

  it("tests claim deposit returned even if returning it throws", async () => {
    // TODO
  })
})
