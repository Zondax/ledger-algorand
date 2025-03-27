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

  generateConfigs(): Array<Record<string, any>> {
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

    // Pubkey options
    const pubkeyOptions = [pubkeyAcc0, pubkeyAcc123];
    
    // Generate a fixed set of dates
    const now = new Date();
    const issuedAt = now.toISOString().replace(/\.\d+Z$/, 'Z');
    const expiryTime = new Date(now.getTime() + (24 * 60 * 60 * 1000 * 30)).toISOString().replace(/\.\d+Z$/, 'Z');
    const notBeforeTime = new Date(now.getTime() - (24 * 60 * 60 * 1000 * 5)).toISOString().replace(/\.\d+Z$/, 'Z');
    
    this.chosenPubkeys = [];
    
    let index = 0;
    
    // Create all possible combinations
    for (const domain of domains) {
      const uri = `https://${domain}`;
      const statement = `We are requesting you to sign this message to authenticate to ${domain}`;
      
      for (const resourceOption of resourceOptions) {
        const resources = JSON.stringify(resourceOption);
        
        for (const pubkey of pubkeyOptions) {
          // Domain in CAIP-122 options
          for (const includeDomainInCaip122 of [true, false]) {
            // Request ID in CAIP-122 options
            for (const includeRequestIdInCaip122 of [true, false]) {
              this.chosenPubkeys.push(pubkey);

              const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
              const accountAddress = Array(58).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');

              const nonce = crypto.randomBytes(32).toString('base64');
              
              const requestId = crypto.randomBytes(16).toString('hex').toUpperCase();
              
              // Build the fields list - first all CAIP-122 fields
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
                caip122Fields.push({ name: "domain", value: domain });
              }
              
              if (includeRequestIdInCaip122) {
                const requestIdBase64 = Buffer.from(requestId as string, 'utf8').toString('base64');
                caip122Fields.push({ name: "request-id", value: requestIdBase64 });
              }
              
              // Generate common additional fields
              const { fields: additionalFields } = generateCommonAdditionalFields(
                domain,
                pubkey,
                requestId
              );

              const isValid = determineVectorValidity(
                caip122Fields,
                additionalFields,
                pubkey
              );

              // Combine all fields in the correct order: all CAIP-122 fields first, then additional fields
              const fields = [...caip122Fields, ...additionalFields];
              
              // Create configuration
              const config = {
                index: index,
                name: `Algorand_CAIP122_${index}`,
                fields: fields,
                valid: isValid
              };
              
              configs.push(config);
              index++;
            }
          }
        }
      }
    }
    
    return configs;
  }
}

export const caip122Generator = new Caip122Generator();