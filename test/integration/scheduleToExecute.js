// This test follows the full flow from the scheduling of a transaction to the execution thereof.
require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

// Contracts
const BlockScheduler = artifacts.require("./BlockScheduler.sol")
const RequestFactory = artifacts.require("./RequestFactory.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequestCore = artifacts.require("./TransactionRequestCore.sol")

const fourtwentyUtil = require("fourtwentyjs-util")
const { waitUntilBlock } = require("@digix/tempo")(web3)

// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData } = require("../dataHelpers.js")

contract("Schedule to execution flow", (accounts) => {
  const smokePrice = config.web3.utils.toMarley("33", "gmarley")
  const testData = fourtwentyUtil.bufferToHex(Buffer.from("I am the test data".padEnd(32, "X123")))

  let blockScheduler
  let requestFactory
  let txRecorder
  let txRequest

  let windowStart

  it("should instantiate the required contracts", async () => {
    txRecorder = await TransactionRecorder.new()
    expect(txRecorder.address).to.exist

    const transactionRequestCore = await TransactionRequestCore.deployed()
    expect(transactionRequestCore.address).to.exist

    requestFactory = await RequestFactory.new(transactionRequestCore.address)
    expect(requestFactory.address).to.exist

    blockScheduler = await BlockScheduler.new(
      requestFactory.address,
      "0xecc9c5fff8937578141592e7E62C2D2E364311b8"
    )
    expect(blockScheduler.address).to.exist

    // Sanity
    expect(await blockScheduler.factoryAddress()).to.equal(requestFactory.address)
  })

  it("should schedule a transaction", async () => {
    const curBlockNum = await config.web3.fourtwenty.getBlockNumber()
    windowStart = curBlockNum + 20

    const scheduleTx = await blockScheduler.schedule(
      txRecorder.address, // toAddress
      testData, // callData
      [
        1212121, // callSmoke
        123454321, // callValue
        365, // windowSize
        windowStart,
        smokePrice,
        98765, // fee
        80008, // bounty
        config.web3.utils.toMarley("20", "kmarley"), // requiredDeposit
      ],
      { from: accounts[3], value: config.web3.utils.toMarley("1") }
    )

    expect(scheduleTx.receipt).to.exist

    expect(scheduleTx.receipt.smokeUsed).to.be.below(3000000)

    const NewRequest = scheduleTx.logs.find(e => e.event === "NewRequest")
    expect(NewRequest.args.request).to.exist

    txRequest = await TransactionRequestCore.at(NewRequest.args.request)
    expect(txRequest.address).to.exist
  })

  it("verifies the txRequest data", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(requestData.txData.toAddress).to.equal(txRecorder.address)

    expect(await txRequest.callData()).to.equal(testData)

    expect(requestData.schedule.windowSize).to.equal(365)

    expect(requestData.txData.callSmoke).to.equal(1212121)

    expect(requestData.txData.callValue).to.equal(123454321)

    expect(requestData.schedule.windowStart).to.equal(windowStart)

    expect(requestData.txData.smokePrice).to.equal(parseInt(smokePrice, 10))

    expect(requestData.paymentData.fee).to.equal(98765)

    expect(requestData.paymentData.bounty).to.equal(80008)
  })

  it("should claim from an account", async () => {
    // TODO
  })

  it("should execute the transaction with the correct smokePrice", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(await txRecorder.wasCalled()).to.be.false

    expect(requestData.meta.wasCalled).to.be.false

    const startExecutionWindow = requestData.schedule.windowStart
    await waitUntilBlock(0, startExecutionWindow)

    const executeTx = await txRequest.execute({
      from: accounts[9],
      smoke: 3000000,
      smokePrice,
    })

    expect(executeTx.receipt).to.exist

    await requestData.refresh()

    expect(await txRecorder.wasCalled()).to.be.true

    expect(requestData.meta.wasCalled).to.be.true
  })
})
