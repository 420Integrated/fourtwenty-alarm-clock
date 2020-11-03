require("chai")
  .use(require("chai-as-promised"))
  .should()

const { expect } = require("chai")

const PaymentLib = artifacts.require("./PaymentLib.sol")

const BigNumber = require("bignumber.js")
const config = require("../../config")

/**
 * Tests the correct calculation of the endowment from PaymentLib.
 * The endowment is the value that must be sent with the scheduling transaction.
 * It covers the amount of 420coin for:
 *  - payment
 *  - fee
 *  - execution smoke
 *  - callSmoke
 *  - callValue
 */

contract("PaymentLib", () => {
  const { web3 } = config
  let paymentLib

  before(async () => {
    paymentLib = await PaymentLib.deployed()
  })

  it("returns the correct endowment [1/2]", async () => {
    const callSmoke = new BigNumber(3000000)
    const callValue = new BigNumber(123454321)
    const smokePrice = new BigNumber(web3.utils.toMarley("55", "gmarley"))
    const fee = new BigNumber(web3.utils.toMarley("120", "willie"))
    const bounty = new BigNumber(web3.utils.toMarley("250", "willie"))

    const expectedEndowment = bounty
      .plus(fee)
      .plus(callSmoke.mul(smokePrice))
      .plus(smokePrice.mul(180000))
      .plus(callValue)

    const endowment = await paymentLib.computeEndowment(
      bounty,
      fee,
      callSmoke,
      callValue,
      smokePrice,
      180000
    )

    expect(endowment.sub(expectedEndowment).toNumber()).to.equal(0)

    expect(expectedEndowment.toString()).to.equal(endowment.toString())
  })

  it("returns the correct endowment [2/2]", async () => {
    const callSmoke = new BigNumber(3333331)
    const callValue = new BigNumber(web3.utils.toMarley("3", "420coin"))
    const smokePrice = new BigNumber(web3.utils.toMarley("25", "gmarley"))
    const fee = new BigNumber(web3.utils.toMarley("2", "420coin"))
    const bounty = new BigNumber(web3.utils.toMarley("250", "willie"))

    const expectedEndowment = bounty
      .plus(fee)
      .plus(callSmoke.mul(smokePrice))
      .plus(smokePrice.mul(180000))
      .plus(callValue)

    const endowment = await paymentLib.computeEndowment(
      bounty,
      fee,
      callSmoke,
      callValue,
      smokePrice,
      180000
    )

    expect(endowment.sub(expectedEndowment).toNumber()).to.equal(0)

    expect(expectedEndowment.toString()).to.equal(endowment.toString())
  })
})
