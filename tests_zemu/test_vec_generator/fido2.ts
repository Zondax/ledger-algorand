import * as crypto from 'crypto';
import { Encoding, hdPathAcc0, hdPathAcc123, pubkeyAcc0, pubkeyAcc123, Scope } from './common';
import * as base32 from 'hi-base32';
import { BaseRequestBlobCreator, Field } from './requestBlob';

let chosenPubkeys: string[] = [];

export function createFido2RequestBlob(fields: Field[], vectorIdx: number): string {
  const creator = new BaseRequestBlobCreator(chosenPubkeys);
  return creator.createRequestBlob(fields, vectorIdx);
}

export function generateRandomFido2Configs(count: number = 1): Array<Record<string, any>> {
  const configs: Array<Record<string, any>> = [];
  
  // Common domains relevant to Algorand ecosystem
  const domains = ["webauthn.io"];
  
  // Possible request types
  const requestTypes = ["webauthn.create", "webauthn.get"];
  
  for (let i = 0; i < count; i++) {
    // Generate random domain for origin
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const origin = `https://${domain}`;
    
    // Generate random challenge (base64 encoded 32 bytes)
    const challenge = crypto.randomBytes(32).toString('base64');
    
    // SHA512-256 function
    const sha512_256 = (data: Buffer): Buffer => {
      return crypto.createHash('sha512').update(data).digest().slice(0, 32);
    };
    
    // Convert to Algorand address format
    const pubkey = Math.random() < 0.5 ? pubkeyAcc0 : pubkeyAcc123;
    chosenPubkeys.push(pubkey);
    const pubkeyBytes = Buffer.from(pubkey, 'hex');
    const checksum = sha512_256(pubkeyBytes).slice(0, 4);
    const addrBytes = Buffer.concat([Buffer.from([1]), pubkeyBytes, checksum]);
    let signer = base32.encode(addrBytes).replace(/=+$/, '');

    // Generate random request ID (base64 encoded 32 bytes)
    const requestId = crypto.randomBytes(32).toString('base64');
    
    // Generate auth data as sha256 hash of the domain
    const authData = crypto.createHash('sha256').update(domain).digest('hex');
    
    // Create base fields for FIDO2 request (required fields)
    const fido2Data: Record<string, any> = {
      origin: origin,
      challenge: challenge,
    };
    
    // Add optional fields with probability
    if (Math.random() < 0.5) {
      fido2Data.type = requestTypes[Math.floor(Math.random() * requestTypes.length)];
    }
    
    if (Math.random() < 0.5) {
      fido2Data.rpId = domain;
    }
    
    if (Math.random() < 0.5) {
      // Generate random userId (base64 encoded 16 bytes)
      fido2Data.userId = crypto.randomBytes(16).toString('base64');
    }

    if (Math.random() < 0.5) {
      // Simple extension example
      fido2Data.extensions = { appid: `https://${domain}/app` };
    }
    
    // Build fields list
    const fields: Field[] = [];
    
    // Add each field from the JSON object individually
    for (const [key, value] of Object.entries(fido2Data)) {
      fields.push({ name: key, value: String(value) });
    }
    
    // Additional fields for blob generation
    fields.push({ name: "Signer", value: signer });
    fields.push({ name: "Auth Data", value: authData });
    fields.push({ name: "Domain", value: domain });
    
    const includeRequestIdInBlob = Math.random() < 0.5;
    if (includeRequestIdInBlob) {
      fields.push({ name: "Request ID", value: requestId });
    }

    const includeHdPathInBlob = Math.random() < 0.5;
    let hdPath = "";
    if (includeHdPathInBlob) {
      hdPath = Math.random() < 0.5 ? hdPathAcc0 : hdPathAcc123;
      fields.push({ name: "hdPath", value: hdPath });
    }

    console.log(hdPath, pubkey, includeHdPathInBlob);

    const isValid = (
      (includeHdPathInBlob && hdPath === hdPathAcc0 && pubkey === pubkeyAcc0) ||
      (includeHdPathInBlob && hdPath === hdPathAcc123 && pubkey === pubkeyAcc123) ||
      (!includeHdPathInBlob && pubkey === pubkeyAcc0)
    );

    console.log("isValid :", isValid);
    
    // Create configuration
    const config = {
      index: i,
      name: `Algorand_FIDO2_${i}`,
      fields: fields,
      valid: isValid
    };
    
    configs.push(config);
  }
  
  return configs;
}