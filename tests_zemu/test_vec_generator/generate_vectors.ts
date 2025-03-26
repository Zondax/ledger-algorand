#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { generateTestVector } from './common';
import { caip122Generator } from './caip122';
import { fido2Generator } from './fido2';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('output', {
      type: 'string',
      default: '../tests/testcases_arbitrary_sign.json',
      description: 'Output JSON file'
    })
    .option('count', {
      type: 'number',
      default: 1,
      description: 'Number of random test vectors to generate per type (CAIP-122 and FIDO2)'
    })
    .parse();

  // Ensure output directory exists
  const outputDir = path.dirname(argv.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const testVectors: any[] = [];
  
  // Define all protocol generators
  const protocolGenerators = [
    caip122Generator,
    fido2Generator
  ];
  
  // Process each generator to create test vectors
  let currentIndex = 0;
  for (const generator of protocolGenerators) {
    const configs = generator.generateConfigs(argv.count);
    
    for (const config of configs) {
      // Generate the blob if it doesn't exist
      if (!config.blob || config.blob === "") {
        config.blob = generator.createBlob(config.fields, config.index);
      }

      const testVector = generateTestVector(
        currentIndex++,
        config.name,
        config.blob,
        config.fields,
        config.valid
      );
      testVectors.push(testVector);
    }
  }
  
  fs.writeFileSync(argv.output, JSON.stringify(testVectors, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}