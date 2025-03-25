import * as crypto from 'crypto';
import { appendFieldToBlob, Encoding, Scope } from './common';
import * as base32 from 'hi-base32';

interface Field {
  name: string;
  value: string;
}

export function createFido2RequestBlob(fields: Field[]): string {
  // Extract FIDO2 fields
  const fido2Data: Record<string, any> = {};
  
  // Define external field names (these are never part of FIDO2 data)
  const externalFieldNames = ["Signer", "Domain", "Request ID", "Auth Data"];
  
  // Find the index of the first external field
  let externalStartIdx = fields.length;
  for (let i = 0; i < fields.length; i++) {
    if (externalFieldNames.includes(fields[i].name)) {
      externalStartIdx = i;
      break;
    }
  }
  
  // Now collect all FIDO2 fields (anything before the first external field)
  for (let i = 0; i < externalStartIdx; i++) {
    const field = fields[i];
    const fieldName = field.name;
    const fieldValue = field.value;
    
    // Handle field values based on their types
    if (/^\d+$/.test(fieldValue)) {
      fido2Data[fieldName] = parseInt(fieldValue, 10);
    } else if (/^(true|false)$/i.test(fieldValue)) {
      fido2Data[fieldName] = fieldValue.toLowerCase() === 'true';
    } else {
      fido2Data[fieldName] = fieldValue;
    }
  }
  
  // Convert FIDO2 data to canonical JSON representation
  const canonicalJson = JSON.stringify(fido2Data, Object.keys(fido2Data).sort(), 0);
  const dataBytes = Buffer.from(canonicalJson, 'utf-8');
  
  // Extract non-FIDO2 fields needed for the blob
  const signer = fields.find(f => f.name === "Signer")?.value || "";
  const authData = fields.find(f => f.name === "Auth Data")?.value || "";
  const requestId = fields.find(f => f.name === "Request ID")?.value || "";
  const domain = fields.find(f => f.name === "Domain")?.value || "";

  // Convert to bytes
  const signerBytes = Buffer.from(signer, 'utf-8');
  const authDataBytes = Buffer.from(authData, 'hex');
  const requestIdBytes = Buffer.from(requestId, 'utf-8');
  const domainBytes = Buffer.from(domain, 'utf-8');

  // Create buffer for the blob
  const blob = Buffer.alloc(0);
  const blobArray = Array.from(blob);

  const scope = Scope.AUTH;
  const encoding = Encoding.BASE64;
  
  // Append each field in the required order
  appendFieldToBlob(blobArray, Array.from(signerBytes));
  blobArray.push(scope);
  blobArray.push(encoding);
  appendFieldToBlob(blobArray, Array.from(dataBytes));
  appendFieldToBlob(blobArray, Array.from(domainBytes));
  appendFieldToBlob(blobArray, Array.from(requestIdBytes));
  appendFieldToBlob(blobArray, Array.from(authDataBytes));
  

  // Convert blob to hex string
  const hexBlob = Buffer.from(blobArray).toString('hex');
  
  return hexBlob;
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
    
    // Generate random signer as an Algorand address
    const pubkey = crypto.randomBytes(32);
    
    // SHA512-256 function
    const sha512_256 = (data: Buffer): Buffer => {
      return crypto.createHash('sha512').update(data).digest().slice(0, 32);
    };
    
    // Convert to Algorand address format
    const checksum = sha512_256(pubkey).slice(0, 4);
    const addrBytes = Buffer.concat([Buffer.from([1]), pubkey, checksum]);
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
    fields.push({ name: "Domain", value: domain });
    fields.push({ name: "Request ID", value: requestId });
    fields.push({ name: "Auth Data", value: authData });
    
    // Create configuration
    const config = {
      index: i,
      name: `Algorand_FIDO2_${i}`,
      fields: fields
    };
    
    configs.push(config);
  }
  
  return configs;
}