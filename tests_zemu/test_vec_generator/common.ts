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

export enum ProtocolType {
  CAIP122 = 'CAIP122',
  FIDO2 = 'FIDO2'
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
  protocolType: ProtocolType;
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
  hdPath: string,
  pubkey: string
): boolean {
  return (
    (includeHdPathInBlob && hdPath === hdPathAcc0 && pubkey === pubkeyAcc0) ||
    (includeHdPathInBlob && hdPath === hdPathAcc123 && pubkey === pubkeyAcc123) ||
    (!includeHdPathInBlob && pubkey === pubkeyAcc0)
  );
}

export function generateTestVector(
  index: number,
  name: string,
  blob: string,
  fields: Field[],
  valid: boolean,
  expertMode: boolean = false
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

export { Field };