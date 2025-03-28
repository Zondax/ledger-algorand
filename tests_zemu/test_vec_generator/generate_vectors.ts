#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import yargs, { config } from 'yargs';
import { hideBin } from 'yargs/helpers';

import { Field, FIELD_NAMES, generateTestVector, ProtocolGenerator } from './common';
import { caip122Generator } from './caip122';
import { fido2Generator } from './fido2';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('output', {
      type: 'string',
      default: '../tests/testcases_arbitrary_sign.json',
      description: 'Output JSON file'
    })
    .parse();

  // Ensure output directory exists
  const outputDir = path.dirname(argv.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Define all protocol generators
  const protocolGenerators: ProtocolGenerator[] = [
    caip122Generator,
    fido2Generator
  ];
  
  // Generate test vectors from all generators
  const testVectors = generateVectorsFromGenerators(protocolGenerators);
  
  fs.writeFileSync(argv.output, JSON.stringify(testVectors, null, 2));
}

function generateVectorsFromGenerators(generators: ProtocolGenerator[]): any[] {
  const validTestVectors: any[] = [];
  const invalidTestVectors: any[] = [];
  const allTestVectors: any[] = [];

  let index = 0;
  
  for (const generator of generators) {
    const configs = generator.generateValidConfigs();
    
    for (const config of configs) {
      if (!config.valid) {
        throw new Error("Invalid config found");
      }

      config.blob = generator.createBlob(config.fields, config.index);

      const testVector = generateTestVector(
        index++,
        config.name,
        config.blob,
        config.fields,
        config.valid
      );

      validTestVectors.push(testVector);
    }

    const validConfig = findCompleteValidConfig(configs);
    
    const invalidConfigs = generator.generateInvalidConfigs(validConfig);
    for (const config of invalidConfigs) {
      if (config.valid) {
        throw new Error("Valid config found");
      }
      const testVector = generateTestVector(
        index++,
        config.name,
        config.blob,
        config.fields,
        config.valid
      );
      invalidTestVectors.push(testVector);
    }

    allTestVectors.push(...validTestVectors, ...invalidTestVectors);
  }

  return allTestVectors;
}

/*
  Finds the first valid config that contains all additional fields
  - Signer
  - Domain
  - Request ID
  - Auth Data
  - hdPath
*/
function findCompleteValidConfig(configs: Record<string, any>[]): Record<string, any> {
  return configs.find(config => {
    const fieldNames = Object.values(FIELD_NAMES);
    return fieldNames.every(fieldName => 
      config.fields.some((field: Field) => field.name === fieldName)
    );
  }) as Record<string, any>;
}

if (require.main === module) {
  main().catch(console.error);
}