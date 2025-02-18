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

import Zemu, { DEFAULT_START_OPTIONS, IDeviceModel, isTouchDevice } from '@zondax/zemu'
// @ts-ignore
import AlgorandApp, { ResponseSign } from '@zondax/ledger-algorand'
import { APP_SEED, models } from './common'

// @ts-ignore
import ed25519 from 'ed25519-supercop'
import algosdk from 'algosdk'
import { DEFAULT_NANO_APPROVE_KEYWORD, DEFAULT_STAX_APPROVE_KEYWORD } from '@zondax/zemu/dist/constants'
import { decode } from '@msgpack/msgpack';

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

    const params = await algodClient.getTransactionParams().do();

    const txns: algosdk.Transaction[] = [];

    try {
        txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender2.addr,
            amount: 100000,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn1:", error);
    }

    try {
        txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender2.addr,
            receiver: sender1.addr,
            amount: 50000,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn2:", error);
    }

    try {
        txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender3.addr,
            amount: 300000,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn3:", error);
    }

    try {
        txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender4.addr,
            amount: 400000,
            suggestedParams: params,
        }));
        txns[3].fee = BigInt(30000)
    } catch (error) {
        console.error("Error creating txn4:", error);
    }

    try {
        txns.push(algosdk.makeKeyRegistrationTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn5:", error);
    }

    try {
        txns.push(algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            total: 1000000,
            decimals: 2,
            defaultFrozen: false,
            manager: sender1.addr,
            reserve: sender2.addr,
            freeze: sender3.addr,
            clawback: sender4.addr,
            unitName: "COIN",
            assetName: "TestCoin",
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn6:", error);
    }

    try {
        txns.push(algosdk.makeAssetConfigTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            assetIndex: 1234,
            manager: sender2.addr,
            reserve: sender3.addr,
            freeze: sender4.addr,
            clawback: sender1.addr,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn7:", error);
    }

    try {
        txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender2.addr,
            amount: 1000,
            assetIndex: 1234,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn8:", error);
    }

    try {
        txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: sender1.addr,
            receiver: sender2.addr,
            amount: 3000,
            assetIndex: 1234,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn9:", error);
    }

    try {
        txns.push(algosdk.makeApplicationCreateTxnFromObject({
            sender: sender1.addr,
            suggestedParams: params,
            onComplete: 0,
            approvalProgram: new Uint8Array([0x01]),
            clearProgram: new Uint8Array([0x01]),
            numLocalInts: 0,
            numLocalByteSlices: 0,
            numGlobalInts: 0,
            numGlobalByteSlices: 0,
        }));
    } catch (error) {
        console.error("Error creating txn10:", error);
    }

    try {
        txns.push(algosdk.makeApplicationCreateTxnFromObject({
            sender: sender2.addr,
            suggestedParams: params,
            onComplete: 0,
            approvalProgram: new Uint8Array([0x01]),
            clearProgram: new Uint8Array([0x01]),
            numLocalInts: 0,
            numLocalByteSlices: 0,
            numGlobalInts: 0,
            numGlobalByteSlices: 0,
        }));
    } catch (error) {
        console.error("Error creating txn11:", error);
    }

    try {
        txns.push(algosdk.makeApplicationUpdateTxnFromObject({
            sender: sender1.addr,
            appIndex: 1,
            approvalProgram: new Uint8Array([0x02]),
            clearProgram: new Uint8Array([0x02]),
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn12:", error);
    }

    try {
        txns.push(algosdk.makeApplicationDeleteTxnFromObject({
            sender: sender1.addr,
            appIndex: 1,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn13:", error);
    }

    try {
        txns.push(algosdk.makeApplicationOptInTxnFromObject({
            sender: sender2.addr,
            appIndex: 1,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn14:", error);
    }

    try {
        txns.push(algosdk.makeApplicationCloseOutTxnFromObject({
            sender: sender2.addr,
            appIndex: 1,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn15:", error);
    }

    try {
        txns.push(algosdk.makeApplicationClearStateTxnFromObject({
            sender: sender1.addr,
            appIndex: 1,
            suggestedParams: params,
        }));
    } catch (error) {
        console.error("Error creating txn16:", error);
    }

    const groupID = algosdk.computeGroupID(txns);
    txns.forEach(txn => txn.group = groupID);

    const encodedTxns = txns.map(txn => Buffer.from(txn.toByte()))

    return encodedTxns;
}

jest.setTimeout(300000)

const preComputedTxnGroup = [
  '8aa3616d74ce000186a0a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179',
  '8aa3616d74cdc350a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a3736e64c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a474797065a3706179',
  '8aa3616d74ce000493e0a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c4201dfc37f06b55af370984b4cccbfb4b988c6d76bb3e1071f54fac94e7ae77ed3ca3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179',
  '8aa3616d74ce00061a80a3666565cd7530a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c4207aba3b7f1a7ce9ed63fd1741b66518354519f7091ccbef61221f3445a4da07daa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179',
  '88a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a66b6579726567',
  '89a46170617288a2616ea854657374436f696ea163c4207aba3b7f1a7ce9ed63fd1741b66518354519f7091ccbef61221f3445a4da07daa2646302a166c4201dfc37f06b55af370984b4cccbfb4b988c6d76bb3e1071f54fac94e7ae77ed3ca16dc4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a172c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a174ce000f4240a2756ea4434f494ea3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a461636667',
  '8aa46170617284a163c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a166c4207aba3b7f1a7ce9ed63fd1741b66518354519f7091ccbef61221f3445a4da07daa16dc420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a172c4201dfc37f06b55af370984b4cccbfb4b988c6d76bb3e1071f54fac94e7ae77ed3ca463616964cd04d2a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a461636667',
  '8ba461616d74cd03e8a461726376c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a56178666572a478616964cd04d2',
  '8ba461616d74cd0bb8a461726376c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a56178666572a478616964cd04d2',
  '8aa461706170c40101a461707375c40101a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a46170706c',
  '8aa461706170c40101a461707375c40101a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a474797065a46170706c',
  '8ca46170616e04a461706170c40102a46170696401a461707375c40102a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a46170706c',
  '8aa46170616e05a46170696401a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a46170706c',
  '8aa46170616e01a46170696401a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a474797065a46170706c',
  '8aa46170616e02a46170696401a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a474797065a46170706c',
  '8aa46170616e03a46170696401a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a46170706c',
]

const GROUP_TEST_CASES = [
    {
        bls: true,
        preComputedTxnGroup: preComputedTxnGroup,
    },
    {
        bls: false,
        preComputedTxnGroup: preComputedTxnGroup,
    },
]

describe.each(GROUP_TEST_CASES)('Group tx', function (params) {
  test.concurrent.each(models)('sign group tx', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      // When needing new test cases, create them with createGroupTransaction
      //const txnGroup = await createGroupTransaction(responseAddr.address.toString())
      const txnGroup = params.preComputedTxnGroup.map(txn => Buffer.from(txn, 'hex'))

      if (!txnGroup) {
        throw new Error('Failed to create group transaction')
      }

      if (params.bls) {
        await sim.toggleBlindSigning()
      }

      const accountId = 0

      // do not wait here.. we need to navigate
      const signatureRequest = app.signGroup(accountId, txnGroup)

      const signatureResponse = await navigateTxnGroup(sim, m, params, signatureRequest, "group_tx")

      // Now verify the signature : all signatures must be verified except the 
      // ones that are not meant to be signed by the device
      verifySignatures(signatureResponse, txnGroup, pubKey)
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('single tx in group tx', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const txnGroup = [Buffer.from('8aa3616d74ce000186a0a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179', 'hex')]

      if (params.bls) {
        await sim.toggleBlindSigning()
      }

      const accountId = 0

      try {
        const signatureRequest = await app.signGroup(accountId, txnGroup)
        expect(false).toBe(true)
      } catch (e: any) {
        expect(e.message).toEqual('Single transaction in group')
      }
    } finally {
      await sim.close()
    }
  })

  test.concurrent.each(models)('too many txs in group tx', async function (m) {
    const sim = new Zemu(m.path)
    try {
      await sim.start({ ...defaultOptions, model: m.name })
      const app = new AlgorandApp(sim.getTransport())

      const responseAddr = await app.getAddressAndPubKey()
      const pubKey = responseAddr.publicKey

      const txnGroup = params.preComputedTxnGroup.map(txn => Buffer.from(txn, 'hex'))
      
      // Add txn number 17
      txnGroup.push(Buffer.from('8aa3616d74ce000186a0a3666565cd03e8a26676ce02e8a7a2a367656eac746573746e65742d76312e30a26768c4204863b518a4b3c84ec810f22d4f1081cb0f71f059a7ac20dec62f7f70e5093a22a3677270c420deb6db46b69fd9616dd6be3888b8ac2636b844d78732bf137639c0a3b79c9ecda26c76ce02e8ab8aa3726376c420dd779effe6683ee300e60e2cf717116946e38386254f4663df6052b11220e947a3736e64c4201eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8a474797065a3706179', 'hex'))

      if (params.bls) {
        await sim.toggleBlindSigning()
      }

      const accountId = 0

      try {
        const signatureRequest = await app.signGroup(accountId, txnGroup)
        expect(false).toBe(true)
      } catch (e: any) {
        expect(e.message).toEqual('Too many transactions in group')
      }
    } finally {
      await sim.close()
    }
  })
})


function parseTxSender(txn: Buffer): string {
  try {
    const decoded = decode(txn);
    if (typeof decoded === 'object' && decoded !== null && 'snd' in decoded) {
        // @ts-ignore - We know snd exists from the check above
        return Buffer.from(decoded.snd).toString('hex');
    }
    throw new Error('Invalid transaction format: snd field not found');
  } catch (e) {
    throw new Error(`Failed to parse msgpack`);
  }
}

async function navigateTxnGroup(sim: Zemu, m: IDeviceModel, params: any, signatureRequest: Promise<ResponseSign[]>, name: string) {
    let lastImageIdx = 0
    const approveKeyword =  isTouchDevice(m.name) ? DEFAULT_STAX_APPROVE_KEYWORD : DEFAULT_NANO_APPROVE_KEYWORD

    while (true) {
    try {
        await sim.waitUntilScreenIsNot(sim.getMainMenuSnapshot())
        lastImageIdx = await sim.navigateUntilText('.', `${m.prefix.toLowerCase()}-sign_${name}${params.bls ? '_blindsign' : ''}`, approveKeyword, true, true, lastImageIdx, 15000, true, true, params.bls)
        sim.deleteEvents()
        
        const signatureResponse = await Promise.race([
        signatureRequest,
        new Promise(resolve => setTimeout(resolve, 100))
        ]);

        if (signatureResponse) break;
    } catch (error) {
        console.error('Error during navigation/approval:', error);
        break;
    }
    }

    await sim.compareSnapshots('.', `${m.prefix.toLowerCase()}-sign_${name}${params.bls ? '_blindsign' : ''}`, lastImageIdx)
    const signatureResponse = await signatureRequest;
    return signatureResponse
}

function verifySignatures(signatureResponse: ResponseSign[], txnGroup: Buffer[], pubKey: Buffer) {
    for (let i = 0; i < signatureResponse.length; i++) {
        if (parseTxSender(txnGroup[i]) !== pubKey.toString('hex')) {
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
}