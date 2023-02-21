import * as dotenv from "dotenv"
import { getSignedInteger } from "./random_org_api.js"
import { SigningCosmWasmClient, Secp256k1HdWallet, CosmWasmClient } from "cosmwasm"
import { stringToPath } from "@cosmjs/crypto"
import { assertIsDeliverTxSuccess, calculateFee, GasPrice } from "@cosmjs/stargate"
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx.js"
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx.js"
import { assert, sleep } from "@cosmjs/utils"
import { toUtf8 } from "@cosmjs/encoding"
import crypto from "crypto";
import chalk from "chalk"

dotenv.config();


// Required env vars
assert(process.env.MNEMONIC, "MNEMONIC must be set");
const mnemonic = process.env.MNEMONIC;
assert(process.env.MONIKER, "MONIKER must be set");
const moniker = process.env.MONIKER;
assert(process.env.PREFIX, "PREFIX must be set");
const prefix = process.env.PREFIX;
assert(process.env.DENOM, "DENOM must be set");
// The fee denom
const denom = process.env.DENOM;
assert(process.env.ENDPOINT, "ENDPOINT must be set");
const endpoint = process.env.ENDPOINT;
assert(process.env.AURAND_CONTRACT, "AURAND_CONTRACT must be set");
const aurandContract = process.env.AURAND_CONTRACT;
assert(process.env.GAS_PRICE, "GAS_PRICE must be set. E.g. '0.025ueaura'");
const gasPrice = GasPrice.fromString(process.env.GAS_PRICE);
const gasWanted = parseInt(process.env.GAS_WANTED)
//random org api key
assert(process.env.API_KEY, "API_KEY must be set");
const api_key = process.env.API_KEY;

// Optional env vars
const endpoint2 = process.env.ENDPOINT2 || null;
const endpoint3 = process.env.ENDPOINT3 || null;


const errorColor = chalk.red;
const warningColor = chalk.hex("#FFA500");
const successColor = chalk.green;
const infoColor = chalk.gray;



export async function connectWallet() {
    // Create a wallet
    const path = stringToPath("m/44'/118'/0'/0/0");
    const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, 
            {hdPaths:[path], "prefix":prefix});
    const [firstAccount] = await wallet.getAccounts();
    const client = await SigningCosmWasmClient.connectWithSigner(endpoint, wallet, {
    prefix,
    gasPrice,
    });
    const botAddress = firstAccount.address;

    const balance = await client.getBalance(botAddress,denom)
    console.log("\n------------------------------------------------------------------------------------")
    console.log(successColor("SigningCosmWasmClient CONNECTION Success"))
    console.info(infoColor("account:",botAddress));
    console.info(infoColor("balance:"),balance); 

    return {client, botAddress}
}

let nextSignData = {
    chainId: "",
    accountNumber: NaN,
    sequence: NaN,
};
  
function getNextSignData() {
    let out = { ...nextSignData }; // copy values
    nextSignData.sequence += 1;
    return out;
}
  
// Needed in case an error happened to ensure sequence is in sync
// with chain
export async function resetSignData(client, botAddress) {
    nextSignData = {
      chainId: await client.getChainId(),
      ...(await client.getSequence(botAddress)),
    };
    console.log(infoColor(`Sign data set to: ${JSON.stringify(nextSignData)}`));
}

function sha512_to_base64(input) {
    return crypto.createHash('sha512').update(input).digest('base64')
}

async function GetBotInformation(client, botAddress) {
    const res = await client.queryContractSmart(
        aurandContract, 
        {
            get_bot_info: {
                address: botAddress
            }
        }
    )
    return res
}

async function RegisterBot(client, botAddress) {
    console.info(infoColor("Registering this bot ..."));
    const ExecuteRegisterBot = {
        register_bot: {
            hashed_api_key: sha512_to_base64(api_key),
            moniker: moniker,
        }
    }

    await client.execute(
        botAddress, 
        aurandContract,
        ExecuteRegisterBot,
        "auto"
    )
}

function isSet(a) {
    return a !== null && a !== undefined;
}

async function main() {
    const {client, botAddress} = await connectWallet() // connect to wallet with mnemonic 
    
    const bot_info = await GetBotInformation(client, botAddress)

    // check if the bot is registered or not, if not then do the registration 
    if (!bot_info) {
        await RegisterBot(client, botAddress)

        // We need a bit of a delay between the bot registration tx and the
        // sign data query to ensure the sequence is updated.
        await Promise.all([
            sleep(500), // the min waiting time
            (async function () {
                const res = await GetBotInformation(client, botAddress)

                console.info(infoColor('Bot information:'));
                console.log(res)
            })(),
        ]);
    } else {
        console.info(infoColor('Bot information:'));
        console.log(bot_info)
    }

    await resetSignData(client, botAddress);

    let broadcaster2 = endpoint2 ? await CosmWasmClient.connect(endpoint2) : null;
    let broadcaster3 = endpoint3 ? await CosmWasmClient.connect(endpoint3) : null;

    while(true) {
        try {
            console.info(infoColor("Waiting for commitments ..."))
            const QueryNumberOfCommitment = {
                get_number_of_commitment: {}
            }
            const res = await client.queryContractSmart(
                aurandContract, 
                QueryNumberOfCommitment
            )

            if (res && res.num > 0) {
                console.info(infoColor("Detect commitments ..."))
                console.info(infoColor("Get random org randomness ..."));
                const random_value = await getSignedInteger({api_key: api_key, min: 0, max: 255, amount: 32 }) // get 32 bytes uint8 randomness from random org
                /*
                    /// Example of response
                    {
                        "random": {
                            "method": "generateSignedIntegers",
                            "hashedApiKey": "NdMSNxN+1kGMKhOB...",
                            "n": 32,
                            "min": 0,
                            "max": 255,
                            "replacement": true,
                            "base": 10,
                            "pregeneratedRandomization": null,
                            "data": [196,185,112,10...],
                            "license": {
                                "type": "developer",
                                "text": "Random values licensed strictly for development and testing only",
                                "infoUrl": null
                            },
                            "licenseData": null,
                            "userData": null,
                            "ticketData": null,
                            "completionTime": "2023-02-12 19:27:47Z",
                            "serialNumber": 26
                        },
                        "signature": "jyyXWS5NbX4R53MTx+2G60...",
                        "cost": 0,
                        "bitsUsed": 256,
                        "bitsLeft": 243344,
                        "requestsLeft": 974,
                        "advisoryDelay": 2380
                    }

                    Use random_value.random and random_value.signature to insert randomness
                */
                console.info(successColor(`Receive random value with completion time: ${random_value.random.completionTime}`))

                const msg = {
                    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
                    value: MsgExecuteContract.fromPartial({
                        sender: botAddress,
                        contract: aurandContract,
                        msg: toUtf8(
                            JSON.stringify({
                                add_randomness: {
                                    random_value: JSON.stringify(random_value.random),
                                    signature: random_value.signature
                                },
                            }),
                        ),
                    }),
                };
                
                const memo = "Bot add randomness";
                const signData = getNextSignData(); // Do this the manual way to save one query

                /*
                    As max callback and limit gas callback for each add randomness message in aurand can be changed 
                    so to prevent transaction from running out of gas we can monitor aurand config and set correct 'gasWanted'.
                    But it will cost one more query.

                    
                    A simpler way is to set 'gasWanted' high or use simulation to estimate 'gasWanted'
                */
                let usedFee
                if (gasWanted) {
                    usedFee = calculateFee(gasWanted, gasPrice);
                } else {
                    const gasEstimation = await client.simulate(botAddress, [msg], memo);
                    const multiplier = 1.8;
                    usedFee = calculateFee(Math.round(gasEstimation * multiplier), gasPrice);
                }
                
                const signed = await client.sign(botAddress, [msg], usedFee, memo, signData);
                const tx = Uint8Array.from(TxRaw.encode(signed).finish());

                const p1 = client.broadcastTx(tx);
                const p2 = broadcaster2?.broadcastTx(tx);
                const p3 = broadcaster3?.broadcastTx(tx);
                p1.then(
                    () => console.log(infoColor("Broadcast 1 succeeded")),
                    (err) => console.warn(warningColor(`Broadcast 1 failed: ${err}`)),
                );
                p2?.then(
                    () => console.log(infoColor("Broadcast 2 succeeded")),
                    (err) => console.warn(warningColor(`Broadcast 2 failed: ${err}`)),
                );
                p3?.then(
                    () => console.log(infoColor("Broadcast 3 succeeded")),
                    (err) => console.warn(warningColor(`Broadcast 3 failed: ${err}`)),
                );

                const result = await Promise.any([p1, p2, p3].filter(isSet));
                assertIsDeliverTxSuccess(result);
                
                console.info(
                    successColor(
                    `(Gas: ${result.gasUsed}/${result.gasWanted}; Block height: ${result.height}; Transaction: ${result.transactionHash})`,
                    ),
                )
            } 

            await sleep(1000)
            
        }catch (e) {
            console.error(errorColor(e.toString()));

            // In case of an error, reset the chain ID and sequence to the on-chain values.
            // If this also fails, the process is killed since the error here is not caught anymore.
            console.info(infoColor("Resetting sign data ..."));
            await resetSignData(client, botAddress);
        }
    }
}

main().then(
    () => {
      console.info("Done");
      process.exit(0);
    },
    (error) => {
      console.error(error);
      process.exit(1);
    },
);
