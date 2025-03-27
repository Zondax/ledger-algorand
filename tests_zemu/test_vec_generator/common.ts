import { serializePath } from "./bip32";

interface Field {
  name: string;
  value: string;
}

interface TestVector {
  index: number;
  name: string;
  blob: string;
  valid: boolean;
  output: string[];
  output_expert: string[];
}

export enum Scope {
  AUTH = 0x01,
}

export enum Encoding {
  BASE64 = 0x01,
}

export const pubkeyAcc0 = "1eccfd1ec05e4125fae690cec2a77839a9a36235dd6e2eafba79ca25c0da60f8";
export const pubkeyAcc123 = "0dfdbcdb8eebed628cfb4ef70207b86fd0deddca78e90e8c59d6f441e383b377";
export const hdPathAcc0 = "m/44'/283'/0'/0/0";
export const hdPathAcc123 = "m/44'/283'/123'/0/0";

export interface ProtocolGenerator {
  generateConfigs: () => Array<Record<string, any>>;
  createBlob: (fields: Field[], vectorIdx: number) => string;
}

export function generateAlgorandAddress(pubkey: string): string {
  const crypto = require('crypto');
  const base32 = require('hi-base32');
  
  const sha512_256 = (data: Buffer): Buffer => {
    return crypto.createHash('sha512').update(data).digest().slice(0, 32);
  };
  
  const pubkeyBytes = Buffer.from(pubkey, 'hex');
  const checksum = sha512_256(pubkeyBytes).slice(0, 4);
  const addrBytes = Buffer.concat([Buffer.from([1]), pubkeyBytes, checksum]);
  return base32.encode(addrBytes).replace(/=+$/, '');
}

export function determineVectorValidity(
  dataFields: Field[],
  additionalFields: Field[],
  pubkey: string
): boolean {

  if (!isDataValid(dataFields)) {
    return false;
  }

  const domain = additionalFields.find(f => f.name === FIELD_NAMES.DOMAIN)?.value;
  if (!domain) {
    // Domain is required
    return false;
  }
  if (!isDomainValid(domain)) {
    return false;
  }

  let requestId = additionalFields.find(f => f.name === FIELD_NAMES.REQUEST_ID)?.value;
  if (requestId) {
    let decodedRequestId = Buffer.from(requestId as string, 'base64').toString('hex');
    if (!isRequestIdValid(decodedRequestId)) {
      return false;
    }
  }

  let hdPath = additionalFields.find(f => f.name === FIELD_NAMES.HD_PATH)?.value;
  if (!hdPath) {
    hdPath = hdPathAcc0;
  } 
  if (!isHdPathValid(hdPath)) {
    return false;
  }
  if (!doHdPathAndPubkeyMatch(hdPath, pubkey)) {
    return false;
  }

  return true;
}

function isDataValid(dataFields: Field[]): boolean {
  // Check if data can be parsed as JSON
  try {
    const parsed = JSON.parse(JSON.stringify(dataFields));
    return true;
  } catch (e) {
    return false;
  }
}

function isDomainValid(domain: string): boolean {
  // Check if domain contains only printable ASCII characters (charCodes 32..127)
  return /^[\x20-\x7E]+$/.test(domain);
}

function isRequestIdValid(requestId: string): boolean {
  // Check if requestId is a valid uppercase hex string
  return /^[0-9A-F]+$/.test(requestId);
}

function isHdPathValid(hdPath: string): boolean {
  // Check if hdPath is a valid BIP32 path
  try {
    serializePath(hdPath);
    return true;
  } catch (e) {
    return false;
  }
}

function doHdPathAndPubkeyMatch(hdPath: string, pubkey: string): boolean {
  return (hdPath === hdPathAcc0 && pubkey === pubkeyAcc0) ||
    (hdPath === hdPathAcc123 && pubkey === pubkeyAcc123);
}

export function generateTestVector(
  index: number,
  name: string,
  blob: string,
  fields: Field[],
  valid: boolean,
): TestVector {
  const output: string[] = [];
  const MAX_CHARS_PER_LINE = 38;

  fields.forEach((field, i) => {
    const fieldName = field.name;
    const fieldValue = field.value;

    if (fieldValue.length > MAX_CHARS_PER_LINE) {
      const valueChunks: string[] = [];
      let remaining = fieldValue;

      while (remaining) {
        if (remaining.length <= MAX_CHARS_PER_LINE) {
          valueChunks.push(remaining);
          remaining = "";
        } else {
          valueChunks.push(remaining.slice(0, MAX_CHARS_PER_LINE));
          remaining = remaining.slice(MAX_CHARS_PER_LINE);
        }
      }

      const totalChunks = valueChunks.length;
      valueChunks.forEach((chunk, lineNum) => {
        output.push(`${i} | ${fieldName} [${lineNum + 1}/${totalChunks}] : ${chunk}`);
      });
    } else {
      output.push(`${i} | ${fieldName} : ${fieldValue}`);
    }
  });

  const outputExpert = [...output];

  return {
    index,
    name,
    blob,
    valid,
    output,
    output_expert: outputExpert
  };
}

// Constants for field names
export const FIELD_NAMES = {
  SIGNER: "Signer",
  DOMAIN: "Domain",
  REQUEST_ID: "Request ID",
  AUTH_DATA: "Auth Data",
  HD_PATH: "hdPath"
};

// Function to generate all possible combinations of common additional fields
export function generateCommonAdditionalFields(
  domain: string,
  pubkey: string,
  requestId?: string,
): { fieldCombinations: { fields: Field[]}[] } {
  const crypto = require('crypto');
  const authData = crypto.createHash('sha256').update(domain).digest('hex');
  const signer = generateAlgorandAddress(pubkey);

  // Create deterministic domain variations
  const domains = [
    domain,
    // Invalid domain with non-printable character
    String.fromCharCode(0x07) + domain
  ];

  // Create deterministic request ID if not provided
  if (!requestId) {
    requestId = crypto.randomBytes(16).toString('hex').toUpperCase();
  }
  
  // Create request ID variations
  const requestIds = [
    requestId,
    // Invalid request ID
    requestId + 'a'
  ];

  // HD path options
  const hdPaths = [
    hdPathAcc0,
    hdPathAcc123,
  ];

  // Generate all possible combinations
  const fieldCombinations: { fields: Field[]}[] = [];

  for (const currentDomain of domains) {
    for (const currentRequestId of requestIds) {
      // Option to include or exclude request ID
      for (const includeRequestId of [true, false]) {
        for (const hdPath of hdPaths) {
          const currentFields: Field[] = [
            { name: FIELD_NAMES.SIGNER, value: signer },
            { name: FIELD_NAMES.DOMAIN, value: currentDomain },
            { name: FIELD_NAMES.AUTH_DATA, value: authData }
          ];

          if (includeRequestId) {
            const requestIdBase64 = Buffer.from(currentRequestId as string, 'utf8').toString('base64');
            currentFields.push({ name: FIELD_NAMES.REQUEST_ID, value: requestIdBase64 });
          }

          fieldCombinations.push({
            fields: currentFields,
          });
        }
      }
    }
  }

  return { fieldCombinations };
}

export { Field };