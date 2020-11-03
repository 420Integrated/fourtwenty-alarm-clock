const HDWalletProvider = require("truffle-hdwallet-provider");

// Test Address - 0xD593A23b099e85AE97CAB1b5a645959211B03277
// Main Address - 0x21ec253c9186065f05fb3f541085a185f96a16ee
const mnemonic = "";

module.exports = {
  networks: {
    development: {
      smoke: 4700000,
      smokePrice: 10000000000, // 10 gmarley
      host: "localhost",
      port: 6174,
      network_id: "*" // Match any network id
    },
    mainnet: {
      smoke: 4700000,
      smokePrice: 3000000000, // 3 gmarley
      provider: () => new HDWalletProvider(mnemonic, "https://mainnet.infura.io"),
      network_id: "1",
      // overwrite: false,
    },
    kovan: {
      smoke: 4700000,
      smokePrice: 2800000000, // 2.8 gmarley
      provider: () => new HDWalletProvider(mnemonic, "https://kovan.infura.io"),
      network_id: "42"
    },
    rinkeby: {
      smoke: 4700000,
      smokePrice: 20000000000, // 20 gmarley
      provider: () => new HDWalletProvider(mnemonic, "https://rinkeby.infura.io"),
      network_id: "4"
    },
    ropsten: {
      smoke: 4700000,
      smokePrice: 10000000000, // 10 gmarley
      provider: () => new HDWalletProvider(mnemonic, "https://ropsten.infura.io"),
      network_id: "3"
    },
  }
};
