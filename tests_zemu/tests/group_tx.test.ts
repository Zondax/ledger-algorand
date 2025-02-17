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

import Zemu, { DEFAULT_START_OPTIONS, isTouchDevice } from '@zondax/zemu'
// @ts-ignore
import AlgorandApp from '@zondax/ledger-algorand'
import { APP_SEED, models } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'
import algosdk from 'algosdk'
import { DEFAULT_NANO_APPROVE_KEYWORD, DEFAULT_STAX_APPROVE_KEYWORD } from '@zondax/zemu/dist/constants'

const defaultOptions = {
  ...DEFAULT_START_OPTIONS,
  logging: true,
  custom: `-s "${APP_SEED}"`,
  X11: false,
}

const ALGOD_TOKEN = "";
const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_PORT = "";

async function createGroupTransaction(userAddress: string) {
    const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

    const sender1 = algosdk.generateAccount();
    sender1.addr = algosdk.Address.fromString(userAddress)
    const sender2 = algosdk.generateAccount();
    const sender3 = algosdk.generateAccount();
    const sender4 = algosdk.generateAccount();

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

        const txn4 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender4.addr,
            amount: 400000,
            suggestedParams: params,
        });

        txn4.fee = BigInt(30000)

        const txns = [txn1, txn2, txn3, txn4];

        const groupID = algosdk.computeGroupID(txns);
        txns.forEach(txn => txn.group = groupID);

        const encodedTxns = txns.map(txn => Buffer.from(txn.toByte()))

        return encodedTxns;
    } catch (error) {
        console.error("Error creating group transaction:", error);
    }
}

jest.setTimeout(300000)

const preComputedTxnGroup = [
  '8aa3616d74ce000186a0a3666565cd03e8a26676ce02e89fb2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c4206721def20bcdd40921332346679fa8c5d7b2e6337fc8d105e3bac5340ca2b4aca26c76ce02e8a39aa3726376c420ff8a555ee30e82f2f696a75e3daf18b683d090d9e9e9a6056247316085497032a3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179',
  '8aa3616d74cdc350a3666565cd03e8a26676ce02e89fb2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c4206721def20bcdd40921332346679fa8c5d7b2e6337fc8d105e3bac5340ca2b4aca26c76ce02e8a39aa3726376c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a3736e64c420ff8a555ee30e82f2f696a75e3daf18b683d090d9e9e9a6056247316085497032a474797065a3706179',
  '8aa3616d74ce000493e0a3666565cd03e8a26676ce02e89fb2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c4206721def20bcdd40921332346679fa8c5d7b2e6337fc8d105e3bac5340ca2b4aca26c76ce02e8a39aa3726376c4206138ace34a59f2d671a670aabfc4f5efa21a321b76e9ee574d377760c17ad10fa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179',
  '8aa3616d74ce00061a80a3666565cd7530a26676ce02e89fb2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c4206721def20bcdd40921332346679fa8c5d7b2e6337fc8d105e3bac5340ca2b4aca26c76ce02e8a39aa3726376c420a0dcbe5643c97bb243d4e8f938e2c80df74f80d39c18249ffb5e24b5e173e4f6a3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179'
]

const BLS_MODES = [true, false]
describe.each(BLS_MODES)('Group tx', function (bls) {
  test.concurrent.each(models)('sign group tx', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      // When needing new test cases, create them with createGroupTransaction
      //const txnGroup = await createGroupTransaction(responseAddr.address.toString())
      const txnGroup = preComputedTxnGroup.map(txn => Buffer.from(txn, 'hex'))

      if (!txnGroup) {
        throw new Error('Failed to create group transaction')
      }

      const approveKeyword =  isTouchDevice(m.name) ? DEFAULT_STAX_APPROVE_KEYWORD : DEFAULT_NANO_APPROVE_KEYWORD

      if (bls) {
        await sim.toggleBlindSigning()
      }

      const accountId = 0

      // do not wait here.. we need to navigate
      const signatureRequest = app.signGroup(accountId, txnGroup)

      let imageIdx = 0
      let lastImageIdx = 0
      while (true) {
        try {
          console.log('waiting for screen to be not main menu')
          await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
          lastImageIdx = await sim.navigateUntilText('.', `${m.prefix.toLowerCase()}-sign_group_tx_${bls ? 'blindsign' : 'normal'}`, approveKeyword, true, true, imageIdx, 15000, true, true, bls)
          sim.deleteEvents()
          imageIdx += 5
          
          const signatureResponse = await Promise.race([
            signatureRequest,
            new Promise(resolve => setTimeout(resolve, 100)) // small delay to prevent busy waiting
          ]);

          console.log('transaction approved')
          
          if (signatureResponse) break;
        } catch (error) {
          console.error('Error during navigation/approval:', error);
          break;
        }
      }

      await sim.compareSnapshots('.', `${m.prefix.toLowerCase()}-sign_group_tx_${bls ? 'blindsign' : 'normal'}`, lastImageIdx)
      const signatureResponse = await signatureRequest;
      console.log('signatureResponse', signatureResponse)

      // Now verify the signature : all signatures must be verified except the 
      // second txn, which has a different sender
      for (let i = 0; i < signatureResponse.length; i++) {
        if (i === 1) {
          expect(signatureResponse[i].return_code).toEqual(0x6985)
          expect(signatureResponse[i].error_message).toEqual('Not the sender')
          continue;
        };
        expect(signatureResponse[i].return_code).toEqual(0x9000)
        expect(signatureResponse[i].error_message).toEqual('No errors')
        const prehash = Buffer.concat([Buffer.from('TX'), txnGroup[i]])
        const valid = ed25519.verify(signatureResponse[i].signature, prehash, pubKey)
        expect(valid).toEqual(true)
      }
    } finally {
      await sim.close()
    }
  })
})
