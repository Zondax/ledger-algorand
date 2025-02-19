/** ******************************************************************************
 *  (c) 2018 - 2022 Zondax AG
 *  (c) 2016-2017 Ledger
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
import Transport from "@ledgerhq/hw-transport";
import {ResponseAddress, ResponseAppInfo, ResponseDeviceInfo, ResponseSign, ResponseVersion, ScopeType, StdSigData, StdSigDataResponse, StdSignMetadata} from "./types";
import {
  CHUNK_SIZE,
  ERROR_CODE,
  errorCodeToString,
  getVersion,
  LedgerError,
  P1_VALUES,
  P2_VALUES,
  processErrorResponse,
} from "./common";
import {CLA, INS, PKLEN} from "./config";
import { decode } from '@msgpack/msgpack';
import { canonify } from '@truestamp/canonify';
import * as crypto from 'crypto'

export {LedgerError};
export * from "./types";

function processGetAddrResponse(response: Buffer) {
  const errorCodeData = response.slice(-2);
  const returnCode = (errorCodeData[0] * 256 + errorCodeData[1]);

  const publicKey = response.slice(0, PKLEN).toString('hex')
  const address = response.slice(PKLEN, response.length - 2).toString('ascii')

  return {
    // Legacy
    bech32_address: address,
    compressed_pk: publicKey,
    //
    publicKey,
    address,
    returnCode,
    errorMessage: errorCodeToString(returnCode),
// legacy
    return_code: returnCode,
    error_message: errorCodeToString(returnCode)
  };
}

export default class AlgorandApp {
  private transport: Transport;

  constructor(transport: Transport) {
    if (!transport) {
      throw new Error("Transport has not been defined");
    }
    this.transport = transport;
  }

  static prepareChunks(accountId: number, message: Buffer) {
    const chunks = [];

    // First chunk prepend accountId if != 0
    const messageBuffer = Buffer.from(message);
    let buffer : Buffer;
    if (accountId !== 0) {
      const accountIdBuffer = Buffer.alloc(4);
      accountIdBuffer.writeUInt32BE(accountId)
      buffer = Buffer.concat([accountIdBuffer, messageBuffer]);
    } else {
      buffer = Buffer.concat([messageBuffer]);
    }

    for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE;
      if (i > buffer.length) {
        end = buffer.length;
      }
      chunks.push(buffer.slice(i, end));
    }
    return chunks;
  }

  async signGetChunks(accountId: number, message: string | Buffer) {
    if (typeof message === 'string') {
      return AlgorandApp.prepareChunks(accountId, Buffer.from(message));
    }

    return AlgorandApp.prepareChunks(accountId, message);
  }

  async getVersion(): Promise<ResponseVersion> {
    return getVersion(this.transport).catch(err => processErrorResponse(err));
  }

  async getAppInfo(): Promise<ResponseAppInfo> {
    return this.transport.send(0xb0, 0x01, 0, 0).then(response => {
      const errorCodeData = response.slice(-2);
      const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

      const result: { errorMessage?: string; returnCode?: LedgerError } = {};

      let appName = "err";
      let appVersion = "err";
      let flagLen = 0;
      let flagsValue = 0;

      if (response[0] !== 1) {
        // Ledger responds with format ID 1. There is no spec for any format != 1
        result.errorMessage = "response format ID not recognized";
        result.returnCode = LedgerError.DeviceIsBusy;
      } else {
        const appNameLen = response[1];
        appName = response.slice(2, 2 + appNameLen).toString("ascii");
        let idx = 2 + appNameLen;
        const appVersionLen = response[idx];
        idx += 1;
        appVersion = response.slice(idx, idx + appVersionLen).toString("ascii");
        idx += appVersionLen;
        const appFlagsLen = response[idx];
        idx += 1;
        flagLen = appFlagsLen;
        flagsValue = response[idx];
      }

      return {
        returnCode,
        errorMessage: errorCodeToString(returnCode),
        // legacy
        return_code: returnCode,
        error_message: errorCodeToString(returnCode),
        //
        appName,
        appVersion,
        flagLen,
        flagsValue,
        flagRecovery: (flagsValue & 1) !== 0,
        // eslint-disable-next-line no-bitwise
        flagSignedMcuCode: (flagsValue & 2) !== 0,
        // eslint-disable-next-line no-bitwise
        flagOnboarded: (flagsValue & 4) !== 0,
        // eslint-disable-next-line no-bitwise
        flagPINValidated: (flagsValue & 128) !== 0
      };
    }, processErrorResponse);
  }

  async deviceInfo(): Promise<ResponseDeviceInfo> {
    return this.transport.send(0xe0, 0x01, 0, 0, Buffer.from([]), [0x6e00])
      .then(response => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];

        if (returnCode === 0x6e00) {
          return {
            return_code: returnCode,
            error_message: "This command is only available in the Dashboard"
          };
        }

        const targetId = response.slice(0, 4).toString("hex");

        let pos = 4;
        const secureElementVersionLen = response[pos];
        pos += 1;
        const seVersion = response.slice(pos, pos + secureElementVersionLen).toString();
        pos += secureElementVersionLen;

        const flagsLen = response[pos];
        pos += 1;
        const flag = response.slice(pos, pos + flagsLen).toString("hex");
        pos += flagsLen;

        const mcuVersionLen = response[pos];
        pos += 1;
        // Patch issue in mcu version
        let tmp = response.slice(pos, pos + mcuVersionLen);
        if (tmp[mcuVersionLen - 1] === 0) {
          tmp = response.slice(pos, pos + mcuVersionLen - 1);
        }
        const mcuVersion = tmp.toString();

        return {
          returnCode: returnCode,
          errorMessage: errorCodeToString(returnCode),
          // legacy
          return_code: returnCode,
          error_message: errorCodeToString(returnCode),
          // //
          targetId,
          seVersion,
          flag,
          mcuVersion
        };
      }, processErrorResponse);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPubkey(accountId = 0, requireConfirmation = false): Promise<ResponseAddress> {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(accountId)

    const p1_value = requireConfirmation ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE

    return this.transport
      .send(CLA, INS.GET_PUBLIC_KEY, p1_value, P2_VALUES.DEFAULT, data, [0x9000])
      .then(processGetAddrResponse, processErrorResponse);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getAddressAndPubKey(accountId = 0, requireConfirmation = false): Promise<ResponseAddress> {
    const data = Buffer.alloc(4);
    data.writeUInt32BE(accountId)

    const p1_value = requireConfirmation ? P1_VALUES.SHOW_ADDRESS_IN_DEVICE : P1_VALUES.ONLY_RETRIEVE

    return this.transport
      .send(CLA, INS.GET_ADDRESS, p1_value, P2_VALUES.DEFAULT, data, [0x9000])
      .then(processGetAddrResponse, processErrorResponse);
  }

  async signSendChunk(chunkIdx: number, chunkNum: number, accountId: number, chunk: Buffer, numberOfTxs?: number): Promise<ResponseSign> {
    let p1 = P1_VALUES.MSGPACK_ADD
    let p2 = P2_VALUES.MSGPACK_ADD

    if (chunkIdx === 1) {
      p1 = (accountId !== 0) ? P1_VALUES.MSGPACK_FIRST_ACCOUNT_ID : P1_VALUES.MSGPACK_FIRST
    }
    if (chunkIdx === chunkNum) {
      p2 = P2_VALUES.MSGPACK_LAST
    }

    if (numberOfTxs) {
      p1 |= numberOfTxs << 1
    }

    return this.transport
      .send(CLA, INS.SIGN_MSGPACK, p1, p2, chunk, [
        LedgerError.NoErrors,
        LedgerError.DataIsInvalid,
        LedgerError.BadKeyHandle,
        LedgerError.SignVerifyError
      ])
      .then((response: Buffer) => {
        const errorCodeData = response.slice(-2);
        const returnCode = errorCodeData[0] * 256 + errorCodeData[1];
        let errorMessage = errorCodeToString(returnCode);

        if (returnCode === LedgerError.BadKeyHandle ||
          returnCode === LedgerError.DataIsInvalid ||
          returnCode === LedgerError.SignVerifyError) {
          errorMessage = `${errorMessage} : ${response
            .slice(0, response.length - 2)
            .toString("ascii")}`;
        }

        if (returnCode === LedgerError.NoErrors && response.length > 2) {
          const signature = response.slice(0, response.length - 2);
          return {
            signature,
            returnCode: returnCode,
            errorMessage: errorMessage,
            // legacy
            return_code: returnCode,
            error_message: errorCodeToString(returnCode),
          };
        }

        return {
          returnCode: returnCode,
          errorMessage: errorMessage,
          // legacy
          return_code: returnCode,
          error_message: errorCodeToString(returnCode),
        } as ResponseSign;

      }, processErrorResponse);
  }

  async sign(accountId = 0, message: string | Buffer, numberOfTxs = 0) {
    return this.signGetChunks(accountId, message).then(chunks => {
      return this.signSendChunk(1, chunks.length, accountId, chunks[0], numberOfTxs).then(async result => {
        for (let i = 1; i < chunks.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop,no-param-reassign
          result = await this.signSendChunk(1 + i, chunks.length, accountId, chunks[i], numberOfTxs)
          if (result.return_code !== ERROR_CODE.NoError) {
            break
          }
        }

        return {
          return_code: result.return_code,
          error_message: result.error_message,
          signature: result.signature,
        }
      }, processErrorResponse)
    })
  }
  async signGroup(accountId = 0, groupTxn: Buffer[]) {
    let numOfTxns = groupTxn.length
    let results: ResponseSign[] = [];
    let txnIsToSign: boolean[] = new Array(numOfTxns).fill(true);

    if (numOfTxns === 0) {
      throw new Error('No transactions to sign')
    } else if (numOfTxns === 1) {
      throw new Error('Single transaction in group')
    } else if (numOfTxns > 16) {
      throw new Error('Too many transactions in group')
    }

    let responsePubKey = await this.getPubkey(accountId)
    let senderPubKey = responsePubKey.publicKey.toString('hex')

    for (let i = 0; i < groupTxn.length; i++) {
      let sender = this.parseTxSender(groupTxn[i])

      if (sender !== senderPubKey) {
        numOfTxns -= 1
        txnIsToSign[i] = false
      }
    }

    if (numOfTxns <= 0) {
      throw new Error('No transactions were meant to be signed by the device')
    }

    for (let i = 0; i < groupTxn.length; i++) {
      let result: ResponseSign

      if (txnIsToSign[i]) {
        result = await this.sign(accountId, groupTxn[i], numOfTxns);

        if (result.return_code !== ERROR_CODE.NoError) {
          throw new Error(`Error signing transaction in group`);
        }
      } else {
        result = {
          return_code: 0x6985,
          error_message: 'Not the sender',
          signature: Buffer.from([]),
          returnCode: 0x6985,
          errorMessage: 'Not the sender'
        }
      }

      results.push(result);
    }

    return results;
  }

  parseTxSender(txn: Buffer): string {
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

  async signData(signingData: StdSigData, metadata: StdSignMetadata): Promise<StdSigDataResponse> {
      // decode signing data with chosen metadata.encoding
      let decodedData: Uint8Array
      let toSign: Uint8Array

      let pubKey: ResponseAddress
      if (signingData.hdPath) {
        let account = parseInt(signingData.hdPath.split('/')[3].replace("'", ''))
        pubKey = await this.getPubkey(account)
      } else {
        pubKey = await this.getPubkey()
      }

      if (!signingData.signer || pubKey.publicKey !== signingData.signer) {
          throw new Error('Invalid Signer');
      }

      // decode data
      switch(metadata.encoding) {
          case 'base64':
              decodedData = Buffer.from(signingData.data, 'base64');
              break;
          default:
              throw new Error('Failed decoding');
      }

      // validate against schema
      switch(metadata.scope) {

          case ScopeType.AUTH:
              // Expects 2 parameters
              // clientDataJson and domain

              // validate clientDataJson is a valid JSON
              let clientDataJson: any;
              try {
                  clientDataJson = JSON.parse(decodedData.toString());
              } catch (e) {
                  throw new Error('Bad JSON');
              }

              console.log('clientDataJson', clientDataJson)

              const canonifiedClientDataJson = canonify(clientDataJson);
              if (!canonifiedClientDataJson) {
                  throw new Error('Bad JSON');
              }

              const domain: string = signingData.domain ?? (() => { throw new Error('Missing Domain') })()
              const authenticatorData: Uint8Array = signingData.authenticationData ?? (() => { throw new Error('Missing Authentication Data') })()

              // Craft authenticatorData from domain
              // sha256
              const rp_id_hash: Buffer = crypto.createHash('sha256').update(domain).digest();

              // check that the first 32 bytes of authenticatorDataHash are the same as the sha256 of domain
              if(Buffer.compare(authenticatorData.slice(0, 32), rp_id_hash) !== 0) {
                  throw new Error('Failed Domain Auth');
              }
              
              const clientDataJsonHash: Buffer = crypto.createHash('sha256').update(canonifiedClientDataJson).digest();
              const authenticatorDataHash: Buffer = crypto.createHash('sha256').update(authenticatorData).digest();

              // Concatenate clientDataJsonHash and authenticatorData
              toSign = Buffer.concat([clientDataJsonHash, authenticatorDataHash]);
              break;

          default:
              throw new Error('Invalid Scope');
      }

      const signatureResponse = await this.rawSign(signingData.domain, decodedData, toSign);
      const signature: Uint8Array = signatureResponse.signature;

      // craft response
      return {
          ...signingData,
          signature: signature
      }
  }

  private async rawSign(domain: string, data: Uint8Array, toSign: Uint8Array): Promise<ResponseSign> {
    const message = Buffer.concat([
        Buffer.from(toSign),
        Buffer.from(domain + '\0'),
        data
    ])

    const chunks = [];
    for (let i = 0; i < message.length; i += CHUNK_SIZE) {
      let end = i + CHUNK_SIZE;
      if (end > message.length) {
        end = message.length;
      }
      chunks.push(message.slice(i, end));
    }

    console.log('chunks', chunks.map(chunk => chunk.toString('hex')))

    let return_code = 0
    let response = Buffer.from([])
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      const p1 = i === 0 ? P1_VALUES.MSGPACK_FIRST : P1_VALUES.MSGPACK_ADD;
      const p2 = isLastChunk ? P2_VALUES.MSGPACK_LAST : P2_VALUES.MSGPACK_ADD;

      response = await this.transport.send(CLA, INS.SIGN_ARBITRARY, p1, p2, chunks[i]);
      return_code = response.slice(-2)[0] * 256 + response.slice(-2)[1]

      if (return_code !== ERROR_CODE.NoError) {
        break;
      }
    }

    return {
      signature: response.slice(0, response.length - 2),
      returnCode: return_code,
      errorMessage: errorCodeToString(return_code),
      return_code: return_code,
      error_message: errorCodeToString(return_code),
    }
  }
}
