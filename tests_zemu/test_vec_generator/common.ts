import { serializePath } from "./bip32";
import * as crypto from 'crypto';
import { BaseBlobCreator } from "./blobCreator";
import assert from "assert";

interface Field {
  name: string;
  value: string;
}

export interface TestVector {
  index: number;
  name: string;
  blob: string;
  error: string;
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
export const signerAcc0 = "D3GP2HWALZASL6XGSDHMFJ3YHGU2GYRV3VXC5L52PHFCLQG2MD4KIPKKAA";
export const signerAcc123 = "BX63ZW4O5PWWFDH3J33QEB5YN7IN5XOKPDUQ5DCZ232EDY4DWN3XKUQRCA";

export const COMMON_RANDOMNESS_SEED = 'common-fixed-seed'

export abstract class ProtocolGenerator {
  protected chosenPubkeys: string[] = [];

  abstract generateValidConfigs(): Array<Record<string, any>>;

  createBlob(dataBytes: Buffer, fields: Field[], vectorIdx: number): string {
    const creator = new BaseBlobCreator(this.chosenPubkeys);
    return creator.createBlob(dataBytes, fields, vectorIdx);
  }

  generateInvalidConfigs(validConfig: Record<string, any>): Array<Record<string, any>> {
    const invalidConfigs: Array<Record<string, any>> = [];
    const validConfigWithoutBlob = { ...validConfig };
    delete validConfigWithoutBlob.blob;
    
    const invalidDataConfigUnsortedKeys = createInvalidDataConfigUnsortedKeys(structuredClone(validConfigWithoutBlob));
    const invalidDomainConfig = createInvalidDomainConfig(structuredClone(validConfigWithoutBlob));
    const invalidRequestIdConfig = createInvalidRequestIdConfig(structuredClone(validConfigWithoutBlob));
    const invalidHdPathConfig = createInvalidHdPathConfig(structuredClone(validConfigWithoutBlob));
    const invalidSignerHdPathConfig = createInvalidSignerHdPathConfig(structuredClone(validConfigWithoutBlob));

    invalidConfigs.push(invalidDataConfigUnsortedKeys);
    invalidConfigs.push(invalidDomainConfig);
    invalidConfigs.push(invalidRequestIdConfig);
    invalidConfigs.push(invalidHdPathConfig);
    invalidConfigs.push(invalidSignerHdPathConfig);

    return invalidConfigs;
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

  findExternalFieldsStartIndex(fields: Field[], externalFieldNames: string[]): number {
    for (let i = 0; i < fields.length; i++) {
      if (externalFieldNames.includes(fields[i].name)) {
        return i;
      }
    }
    return fields.length;
  }
}

function changeConfigName(config: Record<string, any>, new_name: string): Record<string, any> {
  // Get the base name without the index (format: `Algorand_<Protocol>_${index}`)
  const oldName = config.name;
  const baseName = oldName.substring(0, oldName.lastIndexOf('_'));
  const newName = `${baseName}_${new_name}`;
  config.name = newName;
  return config;
}

function createInvalidDataConfigUnsortedKeys(validConfig: Record<string, any>): Record<string, any> {
  assert(validConfig.fields.length >= 2);

  const invalidConfig = validConfig;
  const firstFieldKey = validConfig.fields[0].name;
  const firstFieldValue = validConfig.fields[0].value;
  const secondFieldKey = validConfig.fields[1].name;
  const secondFieldValue = validConfig.fields[1].value;
  invalidConfig.fields[0].name = secondFieldKey;
  invalidConfig.fields[0].value = secondFieldValue;
  invalidConfig.fields[1].name = firstFieldKey;
  invalidConfig.fields[1].value = firstFieldValue;
  invalidConfig.error = "Bad JSON";
  return changeConfigName(invalidConfig, "Invalid_Data_Unsorted_Keys");
}

function createInvalidDomainConfig(validConfig: Record<string, any>): Record<string, any> {
  const invalidConfig = validConfig;
  const domain = validConfig.fields.find((f: Field) => f.name === FIELD_NAMES.DOMAIN)?.value;

  if (domain) {
    const invalidDomain = domain + String.fromCharCode(0x07);
    const domainFieldIndex = invalidConfig.fields.findIndex((f: Field) => f.name === FIELD_NAMES.DOMAIN);

    if (domainFieldIndex !== -1) {
      invalidConfig.fields = [...invalidConfig.fields];  // Create a new array to avoid reference issues
      invalidConfig.fields[domainFieldIndex] = { name: FIELD_NAMES.DOMAIN, value: invalidDomain };
      invalidConfig.error = "Invalid Domain";
      return changeConfigName(invalidConfig, "Invalid_Domain");
    } 
  }

  throw new Error("Domain field not found in valid config");
}

function createInvalidRequestIdConfig(validConfig: Record<string, any>): Record<string, any> {
  const invalidConfig = validConfig;
  const requestId = validConfig.fields.find((f: Field) => f.name === FIELD_NAMES.REQUEST_ID)?.value;
  const decodedRequestId = Buffer.from(requestId as string, 'base64').toString('hex').toUpperCase();

  if (requestId) {
    // '61' is the ASCII code for 'a'
    // '62' is the ASCII code for 'b'
    const invalidRequestId = '61' + decodedRequestId + '62';
    const requestIdFieldIndex = invalidConfig.fields.findIndex((f: Field) => f.name === FIELD_NAMES.REQUEST_ID);
    if (requestIdFieldIndex !== -1) {
      const base64RequestId = Buffer.from(invalidRequestId, 'hex').toString('base64');
      invalidConfig.fields = [...invalidConfig.fields];  // Create a new array to avoid reference issues
      invalidConfig.fields[requestIdFieldIndex] = { name: FIELD_NAMES.REQUEST_ID, value: base64RequestId };
      invalidConfig.error = "Invalid Request ID";
      return changeConfigName(invalidConfig, "Invalid_Request_ID");
    } 
  }

  throw new Error("Request ID field not found in valid config");
}

function createInvalidSignerHdPathConfig(validConfig: Record<string, any>): Record<string, any> {
  const invalidConfig = validConfig;
  const hasSigner = validConfig.fields.find((f: Field) => f.name === FIELD_NAMES.SIGNER);
  const hasHdPath = validConfig.fields.find((f: Field) => f.name === FIELD_NAMES.HD_PATH);

  if (hasSigner && hasHdPath) {
    const signerFieldIndex = invalidConfig.fields.findIndex((f: Field) => f.name === FIELD_NAMES.SIGNER);
    const hdPathFieldIndex = invalidConfig.fields.findIndex((f: Field) => f.name === FIELD_NAMES.HD_PATH);

    if (signerFieldIndex !== -1 && hdPathFieldIndex !== -1) {
      invalidConfig.fields = [...invalidConfig.fields];  // Create a new array to avoid reference issues
      invalidConfig.fields[signerFieldIndex] = { name: FIELD_NAMES.SIGNER, value: signerAcc0 };
      invalidConfig.fields[hdPathFieldIndex] = { name: FIELD_NAMES.HD_PATH, value: hdPathAcc123 };
      invalidConfig.error = "Invalid Signer";
      return changeConfigName(invalidConfig, "Invalid_Signer_for_HdPath");
    }
  }

  throw new Error("Signer or HD Path field not found in valid config");
}

function createInvalidHdPathConfig(validConfig: Record<string, any>): Record<string, any> {
  const invalidConfig = validConfig;
  const hasHdPath = invalidConfig.fields.find((f: Field) => f.name === FIELD_NAMES.HD_PATH);

  if (hasHdPath) {
    const hdPathFieldIndex = invalidConfig.fields.findIndex((f: Field) => f.name === FIELD_NAMES.HD_PATH);

    if (hdPathFieldIndex !== -1) {
      // Ethereum hdPath
      invalidConfig.fields = [...invalidConfig.fields];  // Create a new array to avoid reference issues
      invalidConfig.fields[hdPathFieldIndex] = { name: FIELD_NAMES.HD_PATH, value: "m/44'/66'/0'/0/0" };
      invalidConfig.error = "Failed HD Path";
      return changeConfigName(invalidConfig, "Invalid_HdPath");
    }
  }

  throw new Error("HD Path field not found in valid config");
}

export function generateAlgorandAddress(pubkey: string): string {
  if (pubkey === pubkeyAcc0) {
    return signerAcc0;
  } else if (pubkey === pubkeyAcc123) {
    return signerAcc123;
  } else {
    throw new Error("Invalid public key");
  }
}

export function determineVectorValidity(
  dataFields: Field[],
  additionalFields: Field[],
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
    let decodedRequestId = Buffer.from(requestId as string, 'base64').toString('hex').toUpperCase();
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

  const signer = additionalFields.find(f => f.name === FIELD_NAMES.SIGNER)?.value;
  if (!signer) {
    // Signer is required
    return false;
  }
  if (!doHdPathAndSignerMatch(hdPath, signer)) {
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

function doHdPathAndSignerMatch(hdPath: string, signer: string): boolean {
  return (hdPath === hdPathAcc0 && signer === signerAcc0) ||
    (hdPath === hdPathAcc123 && signer === signerAcc123);
}

export function generateTestVector(
  index: number,
  name: string,
  blob: string,
  fields: Field[],
  error: string,
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
    error,
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
  hdPath: string,
  requestId?: string
): { fieldCombinations: { fields: Field[]}[] } {
  const crypto = require('crypto');
  const authData = crypto.createHash('sha256').update(domain).digest('hex');
  const signer = generateAlgorandAddress(pubkey);

  // Create deterministic request ID if not provided
  if (!requestId) {
    // Replace random generation with deterministic seeded generation
    const input = `${COMMON_RANDOMNESS_SEED}-${domain}-${pubkey}`;
    const hash = crypto.createHash('sha256').update(input).digest('HEX');
    requestId = hash.substring(0, 32).toUpperCase();
  }

  // Generate all possible combinations
  const fieldCombinations: { fields: Field[]}[] = [];

  // Base fields that are always included
  const baseFields: Field[] = [
    { name: FIELD_NAMES.SIGNER, value: signer },
    { name: FIELD_NAMES.DOMAIN, value: domain },
    { name: FIELD_NAMES.AUTH_DATA, value: authData }
  ];

  for (const includeRequestId of [true, false]) {
    const currentFields = [...baseFields];
    
    if (includeRequestId) {
      // The requestId encoding is the hexstring in base64, not the buffer in base64 
      const charsRequestId = Buffer.from(requestId as string, 'utf8')
      const requestIdBase64 = Buffer.from(charsRequestId).toString('base64');
      currentFields.push({ name: FIELD_NAMES.REQUEST_ID, value: requestIdBase64 });
    }

    currentFields.push({ name: FIELD_NAMES.HD_PATH, value: hdPath });

    fieldCombinations.push({
      fields: currentFields,
    });
  }

  return { fieldCombinations };
}

export class RandomGenerator {
  private counter = 0;
  
  constructor(private seed: string = COMMON_RANDOMNESS_SEED) {}
  
  getSeededRandom(purpose: string): number {
    const input = `${this.seed}-${purpose}-${this.counter++}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }
  
  generateRandomBytes(count: number, purposePrefix: string): Buffer {
    let bytes = [];
    for (let i = 0; i < count; i++) {
      bytes.push(Math.floor(this.getSeededRandom(`${purposePrefix}-${i}`) * 256));
    }
    return Buffer.from(bytes);
  }
  
  generateBase64Bytes(count: number, purposePrefix: string): string {
    return this.generateRandomBytes(count, purposePrefix).toString('base64');
  }
  
  generateHexString(length: number, purposePrefix: string, uppercase: boolean = true): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomValue = Math.floor(this.getSeededRandom(`${purposePrefix}-${i}`) * 16);
      result += randomValue.toString(16);
    }
    return uppercase ? result.toUpperCase() : result;
  }
  
  generateStringFromCharset(length: number, charset: string, purposePrefix: string): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(this.getSeededRandom(`${purposePrefix}-${i}`) * charset.length);
      result += charset.charAt(randomIndex);
    }
    return result;
  }
}

export { Field };
