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
  generateConfigs: (count: number) => Array<Record<string, any>>;
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
  includeHdPathInBlob: boolean,
  domain: string,
  requestId: string,
  hdPath: string,
  pubkey: string
): boolean {

  // Check domain is Printable ASCII
  if (!isDomainValid(domain)) {
    return false;
  }

  // Check requestId is UpperCase Hex
  if (!isRequestIdValid(requestId)) {
    return false;
  }

  if (!doHdPathAndPubkeyMatch(includeHdPathInBlob, hdPath, pubkey)) {
    return false;
  }

  return true;
}

function isDomainValid(domain: string): boolean {
  // Check if domain contains only printable ASCII characters (charCodes 32..127)
  return /^[\x20-\x7E]+$/.test(domain);
}

function isRequestIdValid(requestId: string): boolean {
  return /^[0-9A-F]+$/.test(requestId);
}

function doHdPathAndPubkeyMatch(includeHdPathInBlob: boolean, hdPath: string, pubkey: string): boolean {
  if (includeHdPathInBlob) {
    return (hdPath === hdPathAcc0 && pubkey === pubkeyAcc0) ||
      (hdPath === hdPathAcc123 && pubkey === pubkeyAcc123);
  }
  return pubkey === pubkeyAcc0;
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

// Function to generate common additional fields
export function generateCommonAdditionalFields(
  domain: string,
  pubkey: string,
  requestId?: string,
): { fields: Field[], hdPath: string, isValid: boolean } {
  // Generate auth data as sha256 hash of the domain
  const crypto = require('crypto');
  const authData = crypto.createHash('sha256').update(domain).digest('hex');
  const signer = generateAlgorandAddress(pubkey);

  // Create an invalid domain by prepending non-printable ASCII characters
  const invalidDomain = String.fromCharCode(0x07) + domain;

  // 1 of every 10 tests vectors will have an invalid domain
  domain = Math.random() < 0.1 ? invalidDomain : domain;

  const additionalFields: Field[] = [
    { name: FIELD_NAMES.SIGNER, value: signer },
    { name: FIELD_NAMES.DOMAIN, value: domain },
    // AuthData pushed later to keep the order defined in the spec
  ];

  if (!requestId) {
    requestId = crypto.randomBytes(16).toString('hex').toUpperCase();
  }
  const invalidRequestId = requestId + 'a';
  requestId = Math.random() < 0.1 ? invalidRequestId : requestId;
  const requestIdBase64 = Buffer.from(requestId as string, 'utf8').toString('base64');

  const includeRequestId = Math.random() < 0.5;
  if (includeRequestId) {
    additionalFields.push({ name: FIELD_NAMES.REQUEST_ID, value: requestIdBase64 });
  }

  additionalFields.push({ name: FIELD_NAMES.AUTH_DATA, value: authData });

  const includeHdPath = Math.random() < 0.5;
  let hdPath = "";
  if (includeHdPath) {
    hdPath = Math.random() < 0.5 ? hdPathAcc0 : hdPathAcc123;
    additionalFields.push({ name: FIELD_NAMES.HD_PATH, value: hdPath });
  }

  // Determine validity
  const isValid = determineVectorValidity(includeHdPath, domain, requestId as string, hdPath, pubkey);

  return { fields: additionalFields, hdPath, isValid };
}

export { Field };