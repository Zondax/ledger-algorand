/** ******************************************************************************
 *  (c) 2018 - 2025 Zondax AG
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ******************************************************************************* */

import Zemu, { DEFAULT_START_OPTIONS } from '@zondax/zemu'
// @ts-ignore
import AlgorandApp from '@zondax/ledger-algorand'
import { APP_SEED, models } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'
import algosdk from 'algosdk'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

const ALGOD_TOKEN = "";
const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_PORT = "";

async function createGroupTransaction() {
    const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

    const sender1 = algosdk.generateAccount();
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

        const txns = [txn1, txn2, txn3];

        const groupID = algosdk.computeGroupID(txns);
        txns.forEach(txn => txn.group = groupID);

        const encodedTxns = txns.map(txn => Buffer.from(txn.toByte()))

        return encodedTxns;
    } catch (error) {
        console.error("Error creating group transaction:", error);
    }
}

jest.setTimeout(300000)

describe('Group tx', function () {
  test.concurrent.each(models)('sign group tx', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const txnGroup = await createGroupTransaction()

      if (!txnGroup) {
        throw new Error('Failed to create group transaction')
      }

      const accountId = 0

      // do not wait here.. we need to navigate
      const signatureRequest = app.signGroup(accountId, txnGroup)

      // Wait until we are not in the main menu
      await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
      await sim.compareSnapshotsAndApprove('.', `${m.prefix.toLowerCase()}-sign_group_tx`)

      const signatureResponse = await signatureRequest
      console.log(signatureResponse)

      expect(signatureResponse.return_code).toEqual(0x9000)
      expect(signatureResponse.error_message).toEqual('No errors')

      // Now verify the signature
      //const prehash = Buffer.concat([Buffer.from('TX'), txBlob])
      //const valid = ed25519.verify(signatureResponse.signature, prehash, pubKey)
      const valid = false;
      expect(valid).toEqual(true)
    } finally {
      await sim.close()
    }
  })
})
