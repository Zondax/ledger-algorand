/// <reference types="node" />
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
import { ResponseAddress, ResponseAppInfo, ResponseDeviceInfo, ResponseSign, ResponseVersion } from "./types";
import { LedgerError } from "./common";
export { LedgerError };
export * from "./types";
export default class AlgorandApp {
    private transport;
    constructor(transport: Transport);
    static prepareChunks(accountId: number, message: Buffer): Buffer[];
    signGetChunks(accountId: number, message: string | Buffer): Promise<Buffer[]>;
    getVersion(): Promise<ResponseVersion>;
    getAppInfo(): Promise<ResponseAppInfo>;
    deviceInfo(): Promise<ResponseDeviceInfo>;
    getAddressAndPubKey(accountId?: number, requireConfirmation?: boolean): Promise<ResponseAddress>;
    signSendChunk(chunkIdx: number, chunkNum: number, accountId: number, chunk: Buffer): Promise<ResponseSign>;
    sign(accountId: number | undefined, message: string | Buffer): Promise<any>;
}
