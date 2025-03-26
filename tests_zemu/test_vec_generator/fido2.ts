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

  generateConfigs(count: number = 1): Array<Record<string, any>> {
    const configs: Array<Record<string, any>> = [];
    
    // Common domains relevant to Algorand ecosystem
    const domains = ["webauthn.io"];
    
    // Possible request types
    const requestTypes = ["webauthn.create", "webauthn.get"];

    this.chosenPubkeys = [];
    
    for (let i = 0; i < count; i++) {
      // Generate random domain for origin
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const origin = `https://${domain}`;
      
      // Generate random challenge (base64 encoded 32 bytes)
      const challenge = crypto.randomBytes(32).toString('base64');
      
      // Choose pubkey for this test vector
      const pubkey = Math.random() < 0.5 ? pubkeyAcc0 : pubkeyAcc123;
      this.chosenPubkeys.push(pubkey);
      
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
      
      // Generate common additional fields
      const { fields: additionalFields, isValid } = generateCommonAdditionalFields(
        domain,
        pubkey
      );
      
      // Combine all fields
      fields.push(...additionalFields);

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
}

export const fido2Generator = new Fido2Generator();