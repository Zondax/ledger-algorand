import * as crypto from 'crypto';
import { 
  Field, 
  generateCommonAdditionalFields,
  ProtocolGenerator, 
  pubkeyAcc0, 
  pubkeyAcc123,
  determineVectorValidity
} from './common';
import { BaseBlobCreator } from './blobCreator';

class Caip122Generator implements ProtocolGenerator {
  private chosenPubkeys: string[] = [];

  createBlob(fields: Field[], vectorIdx: number): string {
    const creator = new BaseBlobCreator(this.chosenPubkeys);
    return creator.createBlob(fields, vectorIdx);
  }

  generateConfigs(count: number = 1): Array<Record<string, any>> {
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

    this.chosenPubkeys = [];
    
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
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const uri = `https://${domain}`;
      
      // Generate random nonce (base64 encoded 32 bytes)
      const nonce = crypto.randomBytes(32).toString('base64');
      
      // Generate random request IDs (base64 encoded 32 bytes)
      let requestId = crypto.randomBytes(16).toString('hex').toUpperCase();
      
      // Choose pubkey for this test vector
      const pubkey = Math.random() < 0.5 ? pubkeyAcc0 : pubkeyAcc123;
      this.chosenPubkeys.push(pubkey);
      
      // Select random resources
      const resources = JSON.stringify(resourceOptions[Math.floor(Math.random() * resourceOptions.length)]);
      
      // Create human-readable statement
      const statement = `We are requesting you to sign this message to authenticate to ${domain}`;
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

      const includeDomainInCaip122 = Math.random() < 0.5;
      const includeRequestIdInCaip122 = Math.random() < 0.5;
      
      // Add domain and request-id to CAIP-122 fields if chosen
      if (includeDomainInCaip122) {
        caip122Fields.push({ name: "domain", value: domain });
      }
      
      if (includeRequestIdInCaip122) {
        caip122Fields.push({ name: "request-id", value: requestId });
      }
      
      // Generate common additional fields
      const { fields: additionalFields } = generateCommonAdditionalFields(
        domain,
        pubkey,
        requestId
      );

      const includeHdPath = additionalFields.find(f => f.name === "hdPath") !== undefined;
      const hdPath = additionalFields.find(f => f.name === "hdPath")?.value;
      const canonicalJson = JSON.stringify(caip122Fields, Object.keys(caip122Fields).sort(), 0);

      const isValid = determineVectorValidity(
        canonicalJson,
        includeHdPath,
        domain,
        requestId as string,
        hdPath as string,
        pubkey
      );
      
      // Combine all fields in the correct order: all CAIP-122 fields first, then additional fields
      const fields = [...caip122Fields, ...additionalFields];
      
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
}

export const caip122Generator = new Caip122Generator();