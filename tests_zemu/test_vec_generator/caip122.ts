import * as crypto from 'crypto';
import { 
  Field, 
  generateCommonAdditionalFields,
  ProtocolGenerator, 
  pubkeyAcc0, 
  pubkeyAcc123,
  determineVectorValidity,
  FIELD_NAMES,
  hdPathAcc123,
  hdPathAcc0,
  signerAcc0,
  COMMON_RANDOMNESS_SEED,
  RandomGenerator
} from './common';
import { BaseBlobCreator } from './blobCreator';

/**
 * Inserts a field into an array of fields in alphabetical order by field name
 */
function insertFieldAlphabetically(fields: Field[], newField: Field): void {
  const index = fields.findIndex(field => field.name > newField.name);
  if (index !== -1) {
    fields.splice(index, 0, newField);
  } else {
    fields.push(newField);
  }
}

class Caip122Generator extends ProtocolGenerator {
  private randomGenerator = new RandomGenerator();
  
  private generateRequestId(): string {
    return this.randomGenerator.generateHexString(32, 'requestId');
  }
  
  private generateAccountAddress(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    return this.randomGenerator.generateStringFromCharset(58, chars, 'accountAddress');
  }
  
  private generateNonce(): string {
    return this.randomGenerator.generateBase64Bytes(32, 'nonce');
  }
  
  private createCaip122Fields(domain: string, resources: string, accountAddress: string, nonce: string): Field[] {
    const uri = `https://${domain}`;
    const statement = `We are requesting you to sign this message to authenticate to ${domain}`;
    const chainId = "283";  // Algorand Mainnet
    const sigType = "ed25519";  // Algorand uses ed25519 signatures
    const issuedAt = "2023-07-15T10:00:00Z";
    const expiryTime = "2023-08-15T10:00:00Z";
    const notBeforeTime = "2023-07-10T10:00:00Z";
    
    return [
      // Basic mandatory fields for CAIP-122
      { name: "account_address", value: accountAddress },
      { name: "chain_id", value: chainId },
      { name: "expiration-time", value: expiryTime },
      { name: "issued-at", value: issuedAt },
      { name: "nonce", value: nonce },
      { name: "not-before", value: notBeforeTime },
      { name: "resources", value: resources },
      { name: "statement", value: statement },
      { name: "type", value: sigType },
      { name: "uri", value: uri },
      { name: "version", value: "1" },
    ];
  }

  generateValidConfigs(): Array<Record<string, any>> {
    const configs: Array<Record<string, any>> = [];
    this.chosenPubkeys = [];
    let index = 0;
    
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

    const pubKeyHdPathPairs = [
      { pubkey: pubkeyAcc0, hdPath: hdPathAcc0 },
      { pubkey: pubkeyAcc123, hdPath: hdPathAcc123 }
    ];
    
    // Create all possible combinations
    for (const domain of domains) {
      for (const resourceOption of resourceOptions) {
        const resources = JSON.stringify(resourceOption);
        
        for (const pubkeyHdPathPair of pubKeyHdPathPairs) {
          const pubkey = pubkeyHdPathPair.pubkey;
          const hdPath = pubkeyHdPathPair.hdPath;

          // Get all possible additional field combinations
          const requestId = this.generateRequestId();
          const authData = crypto.createHash('sha256').update(domain).digest('hex');
          const { fieldCombinations } = generateCommonAdditionalFields(domain, authData, pubkey, hdPath, requestId);
          
          // Domain in CAIP-122 options
          for (const includeDomainInCaip122 of [true, false]) {
            // Request ID in CAIP-122 options
            for (const includeRequestIdInCaip122 of [true, false]) {
              // Iterate through all additional field combinations
              for (const { fields: additionalFields } of fieldCombinations) {
                this.chosenPubkeys.push(pubkey);

                const accountAddress = this.generateAccountAddress();
                const nonce = this.generateNonce();
                
                // Build the fields list - first all CAIP-122 fields
                const caip122Fields = this.createCaip122Fields(domain, resources, accountAddress, nonce);
                
                // Add domain and request-id to CAIP-122 fields if chosen - inserted alphabetically
                if (includeDomainInCaip122) {
                  insertFieldAlphabetically(caip122Fields, { name: "domain", value: domain });
                }
                
                if (includeRequestIdInCaip122) {
                  let reqId = additionalFields.find(f => f.name === FIELD_NAMES.REQUEST_ID)?.value;
                  if (!reqId) {
                    reqId = this.generateRequestId();
                    const requestIdBase64 = Buffer.from(reqId as string, 'utf8').toString('base64');
                    reqId = requestIdBase64;
                  }
                  insertFieldAlphabetically(caip122Fields, { name: "request-id", value: reqId });
                }
                
                if (determineVectorValidity(caip122Fields, additionalFields) == false) {
                  throw new Error("Invalid config generated");
                }

                // Combine all fields in the correct order: all CAIP-122 fields first, then additional fields
                const fields = [...caip122Fields, ...additionalFields];
                
                // Create configuration
                const config = {
                  index: index,
                  name: `Algorand_CAIP122_${index}`,
                  fields: fields,
                  error: "No error"
                };
                
                configs.push(config);
                index++;
              }
            }
          }
        }
      }
    }
    
    return configs;
  }
}

export const caip122Generator = new Caip122Generator();
