import * as crypto from 'crypto';
import * as cbor from 'cbor';
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
  private randomGenerator = new RandomGenerator();

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

  private generateAuthDataValues(domain: string): string[] {
    /*
    https://www.w3.org/TR/webauthn-2/#sctn-authenticator-data

    rpIdHash
    flags
    signCount
    aaguid
    credentialIdLength
    credentialId
    credentialPublicKey
    extensions
    */

    const bitValues = [false, true];

    const authDataValues: string[] = [];

    const rpIdHash: Buffer = Buffer.from(crypto.createHash('sha256').update(domain).digest('hex'), 'hex');

    for (const up of bitValues) {
      for (const uv of bitValues) {
        for (const at of bitValues) {
          for (const ed of bitValues) {
            var flags: number = 0;

            if (up) {
              flags = flags | 0b00000001
            }
            if (uv) {
              flags = flags | 0b00000100
            }
            if (at) {
              flags = flags | 0b01000000
            }
            if (ed) {
              flags = flags | 0b10000000
            }

            const signCount = this.randomGenerator.generateRandomNumber(0, 2**32 - 1, 'signCount');
            const aaguid: Buffer = this.randomGenerator.generateRandomBytes(16, 'aaguid');
            const credentialId: Buffer = this.randomGenerator.generateRandomBytes(16, 'credentialId');
            const credentialIdLength = credentialId.length;
            const credentialPublicKey = {
              "1": 2,
              "3": -7,
              "-1": 1,
              "-2": this.randomGenerator.generateRandomBytes(32, 'credPubKeyX'),
              "-3": this.randomGenerator.generateRandomBytes(32, 'credPubKeyY')
            };
            const credentialPublicKeyBuffer: Buffer = cbor.encode(credentialPublicKey);
            const extensions: Buffer = this.createExtensionsCBOR();

            var authDataLength = rpIdHash.length + 1 + 4

            if (at) {
              authDataLength += aaguid.length + 2 + credentialIdLength + credentialPublicKeyBuffer.length;
            }
            if (ed) {
              authDataLength += extensions.length;
            }

            const authData: Buffer = Buffer.alloc(authDataLength);

            var offset = 0;
            rpIdHash.copy(authData, offset);
            offset += rpIdHash.length;
            authData.writeUInt8(flags, offset);
            offset += 1;
            authData.writeUInt32LE(signCount, offset);
            offset += 4;

            if (at) {
              aaguid.copy(authData, offset);
              offset += aaguid.length;
              authData.writeUInt16BE(credentialIdLength, offset);
              offset += 2;
              credentialId.copy(authData, offset);
              offset += credentialId.length;
              credentialPublicKeyBuffer.copy(authData, offset);
              offset += credentialPublicKeyBuffer.length;
            }

            if (ed) {
              extensions.copy(authData, offset);
            }

            authDataValues.push(authData.toString('hex'));
          }
        }
      }
    }

    return authDataValues;
  }
  
  private createExtensionsCBOR(): Buffer {
    const extensions = {
      booleanExt: true,
      numericExt: 42,
      stringExt: "test-value"
    };
    return cbor.encode(extensions);
  }

  private createExtensionsString(): string {
    const extensions = {
      booleanExt: true,
      numericExt: 42,
      stringExt: "test-value"
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

        const authDataValues = this.generateAuthDataValues(domain);

        for (const authData of authDataValues) {
        
          // Get all possible additional field combinations
          const { fieldCombinations } = generateCommonAdditionalFields(domain, authData, pubkey, hdPath);
          
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
                        insertFieldAlphabetically(fido2Fields, { name: "extensions", value: this.createExtensionsString() });
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
        }
      }
    }
    
    return configs;
  }
}

export const fido2Generator = new Fido2Generator();
