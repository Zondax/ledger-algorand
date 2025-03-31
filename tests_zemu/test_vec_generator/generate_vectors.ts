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
      default: '../tests/testcases/testcases_arbitrary_sign.json',
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
  let index = 0;
  const allTestVectors: any[] = [];

  for (const generator of generators) {
    const validConfigs = generator.generateValidConfigs();
    const validTestVectors = processConfigs(validConfigs, generator, index, true);
    index += validConfigs.length;
    
    const completeValidConfig = findCompleteValidConfig(validConfigs);
    const invalidConfigs = generator.generateInvalidConfigs(completeValidConfig);
    const invalidTestVectors = processConfigs(invalidConfigs, generator, index, false);
    index += invalidConfigs.length;

    allTestVectors.push(...validTestVectors, ...invalidTestVectors);
  }

  return allTestVectors;
}

/**
 * Process a set of configurations and create test vectors
 * @param configs The configurations to process
 * @param generator The protocol generator to use
 * @param startIndex Starting index for test vector numbering
 * @param expectNoError The error string that is expected for these configs
 * @returns Array of test vectors
 */
function processConfigs(
  configs: Record<string, any>[], 
  generator: ProtocolGenerator, 
  startIndex: number,
  isValid: boolean
): any[] {
  const testVectors: any[] = [];
  let index = startIndex;
  
  for (const config of configs) {
    if (isValid) {
      if (config.error !== "parser_ok") {
        throw new Error(`Config error (${config.error}) should be "parser_ok"`);
      }
    } else {
      if (config.error === "parser_ok") {
        throw new Error(`Config error (${config.error}) shouldn't be "parser_ok"`);
      }
    }

    if (!config.blob) {
      config.blob = generator.createBlob(config.fields, config.index);
    }

    const testVector = generateTestVector(
      index++,
      config.name,
      config.blob,
      config.fields,
      config.error
    );

    testVectors.push(testVector);
  }
  
  return testVectors;
}

/**
 * Finds the first valid config that contains all required fields
 * @param configs Array of configurations to search through
 * @returns The first complete valid configuration
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