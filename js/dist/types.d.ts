/// <reference types="node" />
import { LedgerError } from "./common";
export interface ResponseBase {
    error_message?: string;
    return_code: LedgerError;
    errorMessage?: string;
    returnCode: LedgerError;
}
export interface ResponseAddress extends ResponseBase {
    bech32_address: Buffer;
    compressed_pk: Buffer;
    publicKey: Buffer;
    address: Buffer;
}
export interface ResponseVersion extends ResponseBase {
    test_mode: LedgerError;
    testMode: boolean;
    major: number;
    minor: number;
    patch: number;
    deviceLocked: boolean;
    targetId: string;
}
export interface ResponseAppInfo extends ResponseBase {
    appName: string;
    appVersion: string;
    flagLen: number;
    flagsValue: number;
    flagRecovery: boolean;
    flagSignedMcuCode: boolean;
    flagOnboarded: boolean;
    flagPINValidated: boolean;
}
export interface ResponseDeviceInfo extends ResponseBase {
    targetId: string;
    seVersion: string;
    flag: string;
    mcuVersion: string;
}
export interface ResponseSign extends ResponseBase {
    signature: Buffer;
}
