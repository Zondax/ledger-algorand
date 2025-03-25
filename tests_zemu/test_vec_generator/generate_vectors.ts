#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { generateTestVector } from './common';
import { 
  createCaip122RequestBlob, 
  generateRandomCaip122Configs 
} from './caip122';
import { 
  createFido2RequestBlob, 
  generateRandomFido2Configs 
} from './fido2';

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
  
  // Generate CAIP-122 test vectors
  const caip122Config = generateRandomCaip122Configs(argv.count);
  for (const vectorConfig of caip122Config) {
    // Generate the blob if it doesn't exist
    if (!vectorConfig.blob || vectorConfig.blob === "") {
      vectorConfig.blob = createCaip122RequestBlob(vectorConfig.fields);
    }
    
    const testVector = generateTestVector(
      vectorConfig.index,
      vectorConfig.name,
      vectorConfig.blob,
      vectorConfig.fields,
      true
    );
    testVectors.push(testVector);
  }
  
  // Generate FIDO2 test vectors
  const fido2Config = generateRandomFido2Configs(argv.count);
  // Adjust indices to continue from CAIP-122 vectors
  const offset = testVectors.length;
  
  fido2Config.forEach((vectorConfig, i) => {
    // Generate the blob if it doesn't exist
    if (!vectorConfig.blob || vectorConfig.blob === "") {
      vectorConfig.blob = createFido2RequestBlob(vectorConfig.fields);
    }
    
    const testVector = generateTestVector(
      offset + i,
      vectorConfig.name,
      vectorConfig.blob,
      vectorConfig.fields,
      true
    );
    testVectors.push(testVector);
  });
  
  fs.writeFileSync(argv.output, JSON.stringify(testVectors, null, 2));
}

if (require.main === module) {
  main().catch(console.error);
}