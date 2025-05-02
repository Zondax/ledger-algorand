import * as crypto from 'crypto';
import { Encoding, Field, Scope, FIELD_NAMES } from './common';
import { serializePath, BIP32Path } from './bip32';

// Base interface for blob generation
export interface BlobCreator {
  createBlob(dataBytes: Buffer, additionalFields: Field[], vectorIdx: number): string;
}

// Base class for blob creation
// NOTE: Made it a class so that it can be extended by configuration generators in order to overwrite parseDataFields
export class BaseBlobCreator implements BlobCreator {
  protected pubkeys: string[] = [];
  
  constructor(pubkeys: string[]) {
    this.pubkeys = pubkeys;
  }

  createBlob(dataBytes: Buffer, additionalFields: Field[], vectorIdx: number): string {
    // Extract common fields needed for the blob
    const hdPath = additionalFields.find(f => f.name === FIELD_NAMES.HD_PATH)?.value || "m/44'/283'/0'/0/0";
    const signer = this.pubkeys[vectorIdx];
    const domain = additionalFields.find(f => f.name === FIELD_NAMES.DOMAIN)?.value || "";
    const authData = additionalFields.find(f => f.name === FIELD_NAMES.AUTH_DATA)?.value || "";
    const requestId = additionalFields.find(f => f.name === FIELD_NAMES.REQUEST_ID)?.value || "";
    
    // Convert to bytes
    const hdPathBytes = serializePath(hdPath as BIP32Path);
    const signerBytes = Buffer.from(signer, 'hex');
    const domainBytes = Buffer.from(domain as string, 'utf-8');
    const authDataBytes = Buffer.from(authData, 'hex');
    const requestIdHexStr = Buffer.from(requestId, 'base64').toString('hex');
    const requestIdBytes = Buffer.from(requestIdHexStr, 'hex');

    // Create buffer for the blob
    const blob = Buffer.alloc(0);
    const blobArray = Array.from(blob);
    
    const scope = Scope.AUTH;
    const encoding = Encoding.BASE64;
    
    // Append each field in the required order
    blobArray.push(...Array.from(hdPathBytes));
    blobArray.push(...Array.from(signerBytes));
    blobArray.push(scope);
    blobArray.push(encoding);
    this.appendFieldToBlob(blobArray, Array.from(dataBytes));
    this.appendFieldToBlob(blobArray, Array.from(domainBytes));
    this.appendFieldToBlob(blobArray, Array.from(requestIdBytes));
    this.appendFieldToBlob(blobArray, Array.from(authDataBytes));
    
    // Convert blob to hex string
    return Buffer.from(blobArray).toString('hex');
  }

  // Updated function to correctly handle the buffer as an array
  private appendFieldToBlob(blob: number[], fieldBytes: number[]): void {
    // Create a buffer for length (UInt32BE)
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(fieldBytes.length);
    // Append length and field bytes to the blob
    blob.push(...Array.from(lengthBuffer));
    blob.push(...fieldBytes);
  }
} 
