import * as crypto from 'crypto';
import { hdPathAcc0, hdPathAcc123, pubkeyAcc0, pubkeyAcc123 } from './common';
import * as base32 from 'hi-base32';
import { BaseRequestBlobCreator, Field } from './requestBlob';

let chosenPubkeys: string[] = [];

export function createCaip122RequestBlob(fields: Field[], vectorIdx: number): string {
  const creator = new BaseRequestBlobCreator(chosenPubkeys);
  return creator.createRequestBlob(fields, vectorIdx);
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

  chosenPubkeys = [];
  
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
    
    // Generate auth data as sha256 hash of the domain
    const authData = crypto.createHash('sha256').update(domainExternal).digest('hex');
    
    // Select random resources
    const resources = JSON.stringify(resourceOptions[Math.floor(Math.random() * resourceOptions.length)]);
    
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
      { name: "Auth Data", value: authData },
      { name: "Domain", value: domainExternal },
    ];

    const includeRequestIdInBlob = Math.random() < 0.5;
    if (includeRequestIdInBlob) {
      additionalFields.push({ name: "Request ID", value: requestIdExternal });
    }

    const includeHdPathInBlob = Math.random() < 0.5;
    let hdPath = "";
    if (includeHdPathInBlob) {
      hdPath = Math.random() < 0.5 ? hdPathAcc0 : hdPathAcc123;
      additionalFields.push({ name: "hdPath", value: hdPath });
    }
    
    // Combine fields in the correct order: all CAIP-122 fields first, then additional fields
    const fields = [...caip122Fields, ...additionalFields];

    const isValid = (
      (includeHdPathInBlob && hdPath === hdPathAcc0 && pubkey === pubkeyAcc0) ||
      (includeHdPathInBlob && hdPath === hdPathAcc123 && pubkey === pubkeyAcc123) ||
      (!includeHdPathInBlob && pubkey === pubkeyAcc0)
    );
    
    // Create configuration
    const config = {
      index: i,
      name: `Algorand_CAIP122_${i}`,
      fields: fields,
      valid: isValid
    };
    
    configs.push(config);
  }
  
  return configs;
}