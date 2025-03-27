#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { generateTestVector, ProtocolGenerator } from './common';
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
  
  for (const generator of generators) {
    const configs = generator.generateConfigs();
    
    for (const config of configs) {
      config.blob = generator.createBlob(config.fields, config.index);

      const testVector = generateTestVector(
        0, // Temporary index, will update later
        config.name,
        config.blob,
        config.fields,
        config.valid
      );
      
      if (config.valid) {
        validTestVectors.push(testVector);
      } else {
        invalidTestVectors.push(testVector);
      }
    }
  }
  
  // Combine arrays and fix indexes
  const allVectors = [...validTestVectors, ...invalidTestVectors];
  return allVectors.map((vector, index) => ({
    ...vector,
    index
  }));
}

if (require.main === module) {
  main().catch(console.error);
}