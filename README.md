# Fourtwenty Alarm Clock


__Homepage:__ [Fourtwenty Alarm Clock](http://420integrated.com/420alarmclock/)

__Looking to download the DApp?__: [Latest Releases](https://github.com/420integrated/fourtwenty-alarm-clock-dapp/releases)

## What is the 420-AlarmClock?

The Fourtwenty Alarm Clock is a smart contract protocol for scheduling 420coin transactions 
to be executed in the future. It allows any address to set the parameters of a transaction and 
allow executors (known as _TimeNodes_) to call these transactions during the desired window. 
The 420AlarmClock is agnostic to callers so can be used by both human users and other smart contracts. 
Since all of the scheduling logic is contained in smart contracts, transactions can be scheduled 
from solidity, and developers can rely on it as a core piece of their smart contract of decentralized application.

Additionally the 420AlarmClock faciliates the execution of this pool of scheduled transactions through the TimeNode. 
The 420AlarmClock TimeNode continuously runs and watches for transactions which are scheduled to be executed soon 
then claims and later executes them. For the 420AlarmClock to be successful it depends on users to run TimeNodes. 
There are a few ways incentives for running these TimeNodes are baked in to the protocol itself via the claiming
mechanism and the bounty payout.

See [here](https://blog.chronologic.network/how-to-prove-day-ownership-to-be-a-timenode-3dc1333c74ef) for more information about how to run a TimeNode.

## Documentation

Documentation can be found on [Read the Docs](https://fourtwenty-alarm-clock.readthedocs.io/en/latest/).

We are in progress of migrating the documentation to the [Wiki](https://github.com/fourtwenty-alarm-clock/fourtwenty-alarm-clock/wiki).

## Deployment

Deployed version is [`1.0.0-rc.2`](https://github.com/fourtwenty-alarm-clock/fourtwenty-alarm-clock/releases/tag/v1.0.0-rc.2)

You can find the address for each network in the [networks](https://github.com/fourtwenty-alarm-clock/fourtwenty-alarm-clock/tree/master/networks/) folder. 

## Using the CLI

Please see the [`cli`](https://github.com/fourtwenty-alarm-clock/cli) repository for the commandline client.

## Running the tests

Please ensure you are using node version _at least_ 8.0.0 and have truffle and ganache-cli installed.

```
nvm use lts/carbon
npm i
npm i -g truffle@4.1.14 
npm i -g ganache-cli
```

Start ganache-cli in a terminal screen by running `ganache-cli`.

In another terminal screen run `npm test` at the root of the directory. This will run the npm test script that 
splits up the tests into different runtimes. The tests are split because the 420AlarmClock is a moderately sized project and 
running all the tests with one command has a tendency to break down the ganache tester chain.

Each time you run the tests it is advised to rebuild your build/ folder, as this may lead to bugs if not done. You 
can do this by running the command `rm -rf build/`.


