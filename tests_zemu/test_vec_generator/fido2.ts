import * as crypto from 'crypto';
import { 
  determineVectorValidity,
  Field, 
  FIELD_NAMES,
  generateCommonAdditionalFields,
  ProtocolGenerator, 
  pubkeyAcc0, 
  pubkeyAcc123 
} from './common';
import { BaseBlobCreator } from './blobCreator';

class Fido2Generator implements ProtocolGenerator {
  private chosenPubkeys: string[] = [];

  createBlob(fields: Field[], vectorIdx: number): string {
    const creator = new BaseBlobCreator(this.chosenPubkeys);
    return creator.createBlob(fields, vectorIdx);
  }

  generateConfigs(): Array<Record<string, any>> {
    const configs: Array<Record<string, any>> = [];
    
    // Common domains relevant to FIDO2 ecosystem
    const domains = ["webauthn.io"];
    
    // Possible request types
    const requestTypes = ["webauthn.create", "webauthn.get"];
    
    // Pubkey options
    const pubkeyOptions = [pubkeyAcc0, pubkeyAcc123];

    this.chosenPubkeys = [];
    
    let index = 0;
    
    // Create all possible combinations
    for (const domain of domains) {
      const origin = `https://${domain}`;
      
      for (const pubkey of pubkeyOptions) {
        // Get all possible additional field combinations
        const { fieldCombinations } = generateCommonAdditionalFields(domain, pubkey);
        
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

                    const challenge = crypto.randomBytes(32).toString('base64');
                    
                    const userId = crypto.randomBytes(16).toString('base64');
                    
                    // Create base fields for FIDO2 request (required fields)
                    const fido2Data: Record<string, any> = {
                      origin: origin,
                      challenge: challenge,
                    };
                    
                    // Add optional fields based on the combination
                    if (includeType && requestType) {
                      fido2Data.type = requestType;
                    }
                    
                    if (includeRpId) {
                      fido2Data.rpId = domain;
                    }
                    
                    if (includeUserId) {
                      fido2Data.userId = userId;
                    }

                    if (includeExtensions) {
                      const extensions = {
                        credProps: true,
                        exampleExt: "test-value"
                      };
                      fido2Data.extensions = JSON.stringify(extensions);
                    }
                    
                    // Build fields list
                    const fields: Field[] = [];
                    
                    // Add each field from the JSON object individually
                    for (const [key, value] of Object.entries(fido2Data)) {
                      fields.push({ name: key, value: String(value) });
                    }
                    

                    const isValid = determineVectorValidity(
                      fields,
                      additionalFields,
                      pubkey);

                    fields.push(...additionalFields);

                    // Create configuration
                    const config = {
                      index: index,
                      name: `Algorand_FIDO2_${index}`,
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
        }
      }
    }
    
    return configs;
  }
}

export const fido2Generator = new Fido2Generator();