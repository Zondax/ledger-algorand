import * as crypto from 'crypto';
import { 
  determineVectorValidity,
  Field, 
  FIELD_NAMES,
  generateCommonAdditionalFields,
  hdPathAcc0,
  hdPathAcc123,
  ProtocolGenerator, 
  pubkeyAcc0, 
  pubkeyAcc123,
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

class Fido2Generator extends ProtocolGenerator {
  private chosenPubkeys: string[] = [];
  private randomGenerator = new RandomGenerator();
  
  createBlob(fields: Field[], vectorIdx: number): string {
    const creator = new BaseBlobCreator(this.chosenPubkeys);
    return creator.createBlob(fields, vectorIdx);
  }
  
  private generateChallenge(): string {
    return this.randomGenerator.generateBase64Bytes(32, 'challenge');
  }
  
  private generateUserId(): string {
    return this.randomGenerator.generateBase64Bytes(16, 'userId');
  }
  
  private createBaseFido2Fields(origin: string, challenge: string): Field[] {
    const fields: Field[] = [];
    insertFieldAlphabetically(fields, { name: "challenge", value: challenge });
    insertFieldAlphabetically(fields, { name: "origin", value: origin });
    return fields;
  }
  
  private createExtensions(): string {
    const extensions = {
      credProps: true,
      exampleExt: "test-value"
    };
    return JSON.stringify(extensions);
  }

  generateValidConfigs(): Array<Record<string, any>> {
    const configs: Array<Record<string, any>> = [];
    this.chosenPubkeys = [];
    let index = 0;
    
    // Common domains relevant to FIDO2 ecosystem
    const domains = ["webauthn.io"];
    
    // Possible request types
    const requestTypes = ["webauthn.create", "webauthn.get"];
    
    // Pubkey options
    const pubkeyHdPathPairs = [
      { pubkey: pubkeyAcc0, hdPath: hdPathAcc0 },
      { pubkey: pubkeyAcc123, hdPath: hdPathAcc123 }
    ];
    
    // Create all possible combinations
    for (const domain of domains) {
      const origin = `https://${domain}`;
      
      for (const pubkeyHdPathPair of pubkeyHdPathPairs) {
        const pubkey = pubkeyHdPathPair.pubkey;
        const hdPath = pubkeyHdPathPair.hdPath;
        
        // Get all possible additional field combinations
        const { fieldCombinations } = generateCommonAdditionalFields(domain, pubkey, hdPath);
        
        // Request type options
        for (const includeType of [true, false]) {
          for (const requestType of includeType ? requestTypes : [null]) {
            // RpId options
            for (const includeRpId of [true, false]) {
              // UserId options
              for (const includeUserId of [true, false]) {
                // Extensions options
                for (const includeExtensions of [true, false]) {
                  // Iterate through all additional field combinations
                  for (const { fields: additionalFields } of fieldCombinations) {
                    this.chosenPubkeys.push(pubkey);

                    const challenge = this.generateChallenge();
                    const userId = this.generateUserId();
                    
                    // Create base fields for FIDO2 request
                    const fido2Fields = this.createBaseFido2Fields(origin, challenge);
                    
                    // Add optional fields based on the combination
                    if (includeType && requestType) {
                      insertFieldAlphabetically(fido2Fields, { name: "type", value: requestType });
                    }
                    
                    if (includeRpId) {
                      insertFieldAlphabetically(fido2Fields, { name: "rpId", value: domain });
                    }
                    
                    if (includeUserId) {
                      insertFieldAlphabetically(fido2Fields, { name: "userId", value: userId });
                    }

                    if (includeExtensions) {
                      insertFieldAlphabetically(fido2Fields, { name: "extensions", value: this.createExtensions() });
                    }
                    
                    if (determineVectorValidity(fido2Fields, additionalFields) == false) {
                      throw new Error("Invalid config generated");
                    }

                    // Combine all fields
                    const fields = [...fido2Fields, ...additionalFields];

                    // Create configuration
                    const config = {
                      index: index,
                      name: `Algorand_FIDO2_${index}`,
                      fields: fields,
                      error: "parser_ok"
                    };
                    
                    configs.push(config);
                    index++;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return configs;
  }
}

export const fido2Generator = new Fido2Generator();
