import * as crypto from 'crypto';
import { Encoding, Field, Scope, FIELD_NAMES } from './common';
import { serializePath, BIP32Path } from './bip32';

// Base interface for blob generation
export interface BlobCreator {
  createBlob(fields: Field[], vectorIdx: number): string;
  parseDataFields(fields: Field[], externalStartIdx: number): Record<string, any>;
}

// Helper function to find where external fields start
function findExternalFieldsStartIndex(fields: Field[], externalFieldNames: string[]): number {
  for (let i = 0; i < fields.length; i++) {
    if (externalFieldNames.includes(fields[i].name)) {
      return i;
    }
  }
  return fields.length;
}

// Base class for blob creation
// NOTE: Made it a class so that it can be extended by configuration generators in order to overwrite parseDataFields
export class BaseBlobCreator implements BlobCreator {
  protected pubkeys: string[] = [];
  
  constructor(pubkeys: string[]) {
    this.pubkeys = pubkeys;
  }

  parseDataFields(fields: Field[], externalStartIdx: number): Record<string, any> {
    const data: Record<string, any> = {};
    
    for (let i = 0; i < externalStartIdx; i++) {
      const field = fields[i];
      const fieldName = field.name;
      const fieldValue = field.value;
      
      data[fieldName] = fieldValue;
    }
    
    return data;
  }
  
  createBlob(fields: Field[], vectorIdx: number): string {
    // Find where external fields start
    const externalFieldNames = Object.values(FIELD_NAMES);
    const externalStartIdx = findExternalFieldsStartIndex(fields, externalFieldNames);
    
    // Parse protocol-specific data fields
    const data = this.parseDataFields(fields, externalStartIdx);
    
    // Convert data to canonical JSON representation
    const canonicalJson = JSON.stringify(data, Object.keys(data).sort(), 0);
    const dataBytes = Buffer.from(canonicalJson, 'utf-8');
    
    // Extract common fields needed for the blob
    const signer = this.pubkeys[vectorIdx];
    const domain = fields.find(f => f.name === FIELD_NAMES.DOMAIN)?.value || "";
    const authData = fields.find(f => f.name === FIELD_NAMES.AUTH_DATA)?.value || "";
    const requestId = fields.find(f => f.name === FIELD_NAMES.REQUEST_ID)?.value || "";
    
    // Convert to bytes
    const signerBytes = Buffer.from(signer, 'hex');
    const domainBytes = Buffer.from(domain as string, 'utf-8');
    const authDataBytes = Buffer.from(authData as string, 'utf-8');
    const requestIdBytes = Buffer.from(requestId as string, 'utf-8');
    
    // Create buffer for the blob
    const blob = Buffer.alloc(0);
    const blobArray = Array.from(blob);
    
    const scope = Scope.AUTH;
    const encoding = Encoding.BASE64;
    
    // Append each field in the required order
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
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(fieldBytes.length);
    // Append length and field bytes to the blob
    blob.push(...Array.from(lengthBuffer));
    blob.push(...fieldBytes);
  }
} 
