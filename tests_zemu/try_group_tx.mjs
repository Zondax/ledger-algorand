import TransportNodeHid from '@ledgerhq/hw-transport-node-hid'
import AlgorandApp from '@zondax/ledger-algorand'
// @ts-ignore
import ed25519 from 'ed25519-supercop'
import algosdk from 'algosdk'
const accountId = 123

async function main() {
  const transport = await TransportNodeHid.default.open()
  try {
    const app = new (AlgorandApp.default || AlgorandApp)(transport)

    const responseAddr = await app.getAddressAndPubKey()
    const pubKey = responseAddr.publicKey

    console.log('pubKey', pubKey)

    const txnGroup = await createGroupTransaction(responseAddr.address.toString())

    console.log('txnGroup', txnGroup)

    if (!txnGroup) {
      throw new Error('Failed to create group transaction')
    }

    const accountId = 0

    // do not wait here.. we need to navigate
    const signatureRequest = app.signGroup(accountId, txnGroup)

    const signatureResponse = await signatureRequest;
    console.log('signatureResponse', signatureResponse)

  } finally {
    await transport.close()
  }
}
;(async () => {
  await main()
})()

const ALGOD_TOKEN = "";
const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_PORT = "";

async function createGroupTransaction(userAddress) {
    const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

    const sender1 = algosdk.generateAccount();
    sender1.addr = algosdk.Address.fromString(userAddress)
    const sender2 = algosdk.generateAccount();
    const sender3 = algosdk.generateAccount();

    try {
        const params = await algodClient.getTransactionParams().do();

        const txn1 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender2.addr,
            amount: 100000,
            suggestedParams: params,
        });

        const txn2 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender2.addr,
            receiver: sender1.addr,
            amount: 50000,
            suggestedParams: params,
        });

        const txn3 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender3.addr,
            amount: 300000,
            suggestedParams: params,
        });

        txn3.fee = 30000

        const txns = [txn1, txn2, txn3];

        const groupID = algosdk.computeGroupID(txns);
        txns.forEach(txn => txn.group = groupID);

        const encodedTxns = txns.map(txn => Buffer.from(txn.toByte()))

        return encodedTxns;
    } catch (error) {
        console.error("Error creating group transaction:", error);
    }
}