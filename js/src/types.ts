import {LedgerError} from "./common";

export interface ResponseBase {
  // @deprecated: Please use errorMessage instead
  error_message?: string;
  // @deprecated: Please use returnCode instead
  return_code: LedgerError;

  errorMessage?: string;
  returnCode: LedgerError;
}

export interface ResponseAddress extends ResponseBase {
  // @deprecated: Please use address instead
  bech32_address: Buffer;
  // @deprecated: Please use publicKey instead
  compressed_pk: Buffer;

  publicKey: Buffer;
  address: Buffer;
}

export interface ResponseVersion extends ResponseBase {
  // @deprecated: Please use testMode instead
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
  signature: Buffer
}

export interface HDWalletMetadata {
    purpose: number,
    coinType: number,
    account: number,
    change: number,
    addrIdx: number,
}

export interface StdSigData {
    data: string;
    signer: Uint8Array;
    domain: string;
    authenticationData: Uint8Array;
    requestId?: string;
    hdPath?: HDWalletMetadata;
    signature?: Uint8Array;
}

export interface StdSigDataResponse extends StdSigData {
    signature: Uint8Array;
}

export enum ScopeType {
    UNKNOWN = -1,
    AUTH = 1
}

export interface StdSignMetadata {
    scope: ScopeType;
    encoding: string;
}

export type StdSignature = Uint8Array;

export class SignDataError extends Error {
    constructor(public readonly code: number, message: string, data?: any) {
        super(message);
    }
}

export const ERROR_INVALID_SCOPE: SignDataError = new SignDataError(4600, 'Invalid Scope');
export const ERROR_FAILED_DECODING: SignDataError = new SignDataError(4602, 'Failed decoding');
export const ERROR_INVALID_SIGNER: SignDataError = new SignDataError(4603, 'Invalid Signer');
export const ERROR_MISSING_DOMAIN: SignDataError = new SignDataError(4607, 'Missing Domain');
export const ERROR_MISSING_AUTHENTICATION_DATA: SignDataError = new SignDataError(4608, 'Missing Authentication Data');
export const ERROR_BAD_JSON: SignDataError = new SignDataError(4609, 'Bad JSON');
export const ERROR_FAILED_DOMAIN_AUTH: SignDataError = new SignDataError(4610, 'Failed Domain Auth');