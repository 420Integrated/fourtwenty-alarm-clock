require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

// Contracts
const TransactionRequestCore = artifacts.require("./TransactionRequestCore.sol")

const { waitUntilBlock } = require("@digix/tempo")(web3)

// Bring in config.web3 (v1.0.0)
const config = require("../../config")
const { parseRequestData } = require("../dataHelpers.js")

contract("Exceptions", async (accounts) => {
  const Owner = accounts[0]

  let transactionRequest

  const smokePrice = config.web3.utils.toMarley("66", "gmarley")
  const requiredDeposit = config.web3.utils.toMarley("30", "kmarley")

  // TransactionRequest constants
  const claimWindowSize = 25 // blocks
  const freezePeriod = 5 // blocks
  const reservedWindowSize = 10 // blocks
  const executionWindow = 10 // blocks

  const fee = 12345
  const bounty = 0

  beforeEach(async () => {
    const curBlockNum = await config.web3.fourtwenty.getBlockNumber()
    const windowStart = curBlockNum + 38

    transactionRequest = await TransactionRequestCore.new()
    await transactionRequest.initialize(
      [
        Owner, // createdBy
        Owner, // owner
        accounts[1], // fee recipient
        accounts[3], // toAddress
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

  // TODO: Make this fail
  it("tests transactionRequest for transactions that throw exception", async () => {
    const requestData = await parseRequestData(transactionRequest)
    await waitUntilBlock(0, requestData.schedule.windowStart)

    // console.log(requestData.txData.smokePrice)
    // console.log(smokePrice)
    const executeTx = await transactionRequest.execute({
      from: accounts[6],
      smoke: 3000000,
      smokePrice,
    })

    expect(executeTx.receipt).to.exist

    const { smokeUsed } = executeTx.receipt
    const newRequestData = await parseRequestData(transactionRequest)

    expect(newRequestData.meta.wasCalled).to.be.true

    // expect(newRequestData.meta.wasSuccessful)
    // .to.be.false

    const logExecuted = executeTx.logs.find(e => e.event === "Executed")
    const measuredSmokeConsumption = logExecuted.args.measuredSmokeConsumption.toNumber()

    expect(measuredSmokeConsumption).to.be.above(smokeUsed)

    expect(measuredSmokeConsumption - smokeUsed).to.be.below(120000)
  })

  // TODO: make this fail
  it("tests transactionRequest when everything throws", async () => {
    const requestData = await parseRequestData(transactionRequest)
    await waitUntilBlock(0, requestData.schedule.windowStart)

    // TODO
  })
})
