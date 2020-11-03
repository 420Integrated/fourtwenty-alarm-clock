require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

// Contracts
const RequestLib = artifacts.require("./RequestLib.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequestCore = artifacts.require("./TransactionRequestCore.sol")

const { waitUntilBlock } = require("@digix/tempo")(web3)

// Bring in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, parseAbortData, wasAborted } = require("../dataHelpers.js")

contract("Tests execution smoke requirements", async (accounts) => {
  const smokePrice = config.web3.utils.toMarley("34", "gmarley")
  const requiredDeposit = config.web3.utils.toMarley("34", "kmarley")

  let requestLib
  let txRecorder
  let txRequest

  // TransactionRequest constants
  const claimWindowSize = 25 // blocks
  const freezePeriod = 5 // blocks
  const reservedWindowSize = 10 // blocks
  const executionWindow = 10 // blocks

  const fee = 232323
  const bounty = 343434

  beforeEach(async () => {
    txRecorder = await TransactionRecorder.new()
    expect(txRecorder.address).to.exist

    requestLib = await RequestLib.deployed()

    const curBlockNum = await config.web3.fourtwenty.getBlockNumber()
    const windowStart = curBlockNum + 60

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
        1,
        executionWindow,
        windowStart,
        2000000,
        config.web3.utils.toMarley("122", "willie"),
        smokePrice,
        requiredDeposit,
      ],
      "here-I-am!!-the-call-data",
      { value: config.web3.utils.toMarley("1", "420coin") }
    )
    expect(txRequest.address).to.exist
  })

  it("test direct execution rejected with insufficient smoke", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(await txRecorder.wasCalled()).to.be.false

    await waitUntilBlock(0, requestData.schedule.windowStart)

    const minCallSmoke = requestData.txData.callSmoke
      + (await requestLib.EXECUTION_SMOKE_OVERHEAD()).toNumber()

    const tooLowCallSmoke = minCallSmoke - (await requestLib.PRE_EXECUTION_SMOKE()).toNumber()

    const executeTx = await txRequest.execute({
      smoke: tooLowCallSmoke,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    expect(wasAborted(executeTx)).to.be.true

    expect(parseAbortData(executeTx).find(reason => reason === "InsufficientSmoke")).to.exist

    expect(await txRecorder.wasCalled()).to.be.false
  })

  it("test direct execution accepted with minimum smoke", async () => {
    const requestData = await RequestData.from(txRequest)

    expect(await txRecorder.wasCalled()).to.be.false

    await waitUntilBlock(0, requestData.schedule.windowStart)

    const minCallSmoke = requestData.txData.callSmoke
      + (await requestLib.EXECUTION_SMOKE_OVERHEAD()).toNumber()

    const executeTx = await txRequest.execute({
      smoke: minCallSmoke,
      smokePrice,
    })
    expect(executeTx.receipt).to.exist

    expect(wasAborted(executeTx)).to.be.false

    await requestData.refresh()

    expect(await txRecorder.wasCalled()).to.be.true

    expect(requestData.meta.wasCalled).to.be.true
  })
})
