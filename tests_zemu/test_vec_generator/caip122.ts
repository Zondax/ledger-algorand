import * as crypto from 'crypto';
import { appendFieldToBlob, Encoding, Scope } from './common';
import * as base32 from 'hi-base32';

interface Field {
  name: string;
  value: string | string[];
}

export function createCaip122RequestBlob(fields: Field[]): string {
  // Extract fields for the CAIP-122 request data
  const caip122Data: Record<string, any> = {};
  
  // Define external field names (these are never part of CAIP-122 data)
  const externalFieldNames = ["Signer", "Domain", "Request Id", "Auth Data"];
  
  // Find the index of the first external field
  let externalStartIdx = fields.length;
  for (let i = 0; i < fields.length; i++) {
    if (externalFieldNames.includes(fields[i].name)) {
      externalStartIdx = i;
      break;
    }
  }
  
  // Now collect all CAIP-122 fields (anything before the first external field)
  for (let i = 0; i < externalStartIdx; i++) {
    const field = fields[i];
    const fieldName = field.name;
    const fieldValue = field.value;
    
    // Special handling for resources array
    if (fieldName === "resources" && Array.isArray(fieldValue)) {
      caip122Data[fieldName] = fieldValue;
    }
    // Handle regular fields
    else if (fieldValue !== null && fieldValue !== "") {
      caip122Data[fieldName] = fieldValue;
    }
  }
  
  // Convert CAIP-122 data to canonical JSON representation
  const canonicalJson = JSON.stringify(caip122Data, Object.keys(caip122Data).sort(), 0);

  const dataBytes = Buffer.from(canonicalJson, 'utf-8');
  
  // Extract non-CAIP-122 fields needed for the blob
  const signer = fields.find(f => f.name === "Signer")?.value || "";
  
  // For domain: if there's a domain after the cutoff, use it; otherwise use ""
  const domain = fields.slice(externalStartIdx).find(f => f.name === "Domain")?.value || "";
  
  const authData = fields.find(f => f.name === "Auth Data")?.value || "";
  const requestId = fields.find(f => f.name === "Request ID")?.value || "";

  // Convert to bytes
  const signerBytes = Buffer.from(signer as string, 'utf-8');
  const domainBytes = Buffer.from(domain as string, 'utf-8');
  const authDataBytes = Buffer.from(authData as string, 'utf-8');
  const requestIdBytes = Buffer.from(requestId as string, 'utf-8');

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

export function generateRandomCaip122Configs(count: number = 1): Array<Record<string, any>> {
  const configs: Array<Record<string, any>> = [];
  
  // Algorand-specific chain ID
  const chainId = "283";  // Algorand Mainnet
  const sigType = "ed25519";  // Algorand uses ed25519 signatures
  
  // Domains relevant to Algorand ecosystem
  const domains = ["arc60.io"];
  
  // Common resource options for Algorand
  const resourceOptions = [
    ["auth", "sign"],
    ["transact"],
    ["auth", "transact"],
    ["sign", "transact"],
    ["https://example.com/algorand-claim.json"],
    ["ipfs://QmXZVnfgbEZqQppBYSQBZknjx5PuLwn36aUMRNTNTWwnaT"]
  ];
  
  for (let i = 0; i < count; i++) {
    // Generate random dates - issued now, expiry in future, not-before in past
    const now = new Date();
    const issuedAt = now.toISOString().replace(/\.\d+Z$/, 'Z');
    
    const expiry = new Date(now.getTime() + (24 * 60 * 60 * 1000 * Math.floor(Math.random() * 365) + 1));
    const expiryTime = expiry.toISOString().replace(/\.\d+Z$/, 'Z');
    
    const notBefore = new Date(now.getTime() - (24 * 60 * 60 * 1000 * Math.floor(Math.random() * 10)));
    const notBeforeTime = notBefore.toISOString().replace(/\.\d+Z$/, 'Z');
    
    // Generate Algorand account address (58 characters in Base32)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const accountAddress = Array(58).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    
    // Generate random domain and URI
    const domainCaip122 = domains[Math.floor(Math.random() * domains.length)];
    const domainExternal = domains[Math.floor(Math.random() * domains.length)];  // Can be the same or different
    const uri = `https://${domainCaip122}`;
    
    // Generate random nonce (base64 encoded 32 bytes)
    const nonce = crypto.randomBytes(32).toString('base64');
    
    // Generate random request IDs (base64 encoded 32 bytes)
    const requestIdCaip122 = crypto.randomBytes(32).toString('base64');
    const requestIdExternal = crypto.randomBytes(32).toString('base64');
    
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
    
    // Generate auth data as sha256 hash of the domain
    const authData = crypto.createHash('sha256').update(domainExternal).digest('hex');
    
    // Select random resources
    const resources = resourceOptions[Math.floor(Math.random() * resourceOptions.length)];
    
    // Create human-readable statement
    const statement = `We are requesting you to sign this message to authenticate to ${domainCaip122}`;
    
    // Randomly decide whether to include domain and request-id in CAIP-122 data
    const includeDomainInCaip122 = Math.random() < 0.5;
    const includeRequestIdInCaip122 = Math.random() < 0.5;
    
    // Build the fields list - first all CAIP-122 fields, then additional fields
    const caip122Fields: Field[] = [
      // Basic mandatory fields for CAIP-122
      { name: "account_address", value: accountAddress },
      { name: "chain_id", value: chainId },
      { name: "uri", value: uri },
      { name: "version", value: "1" },
      { name: "type", value: sigType },
      
      // Optional CAIP-122 fields
      { name: "statement", value: statement },
      { name: "nonce", value: nonce },
      { name: "issued-at", value: issuedAt },
      { name: "expiration-time", value: expiryTime },
      { name: "not-before", value: notBeforeTime },
      { name: "resources", value: resources },
    ];
    
    // Add domain and request-id to CAIP-122 fields if chosen
    if (includeDomainInCaip122) {
      caip122Fields.push({ name: "domain", value: domainCaip122 });
    }
    
    if (includeRequestIdInCaip122) {
      caip122Fields.push({ name: "request-id", value: requestIdCaip122 });
    }
    
    // Additional fields for blob generation (not part of CAIP-122 data)
    const additionalFields: Field[] = [
      { name: "Signer", value: signer },
      { name: "Auth Data", value: authData }
    ];
    
    // Always add Domain as external field
    additionalFields.push({ name: "Domain", value: domainExternal });
    
    // Always add Request ID as external field
    additionalFields.push({ name: "Request ID", value: requestIdExternal });
    
    // Combine fields in the correct order: all CAIP-122 fields first, then additional fields
    const fields = [...caip122Fields, ...additionalFields];
    
    // Create configuration
    const config = {
      index: i,
      name: `Algorand_CAIP122_${i}`,
      fields: fields
    };
    
    configs.push(config);
  }
  
  return configs;
}