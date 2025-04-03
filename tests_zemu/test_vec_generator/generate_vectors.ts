#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import yargs, { config } from 'yargs';
import { hideBin } from 'yargs/helpers';

import { Field, FIELD_NAMES, generateTestVector, ProtocolGenerator, TestVector } from './common';
import { caip122Generator } from './caip122';
import { fido2Generator } from './fido2';

/**
 * Configuration object used throughout the generator
 */
interface TestConfig {
  name: string;
  fields: Field[];
  error: string;
  index?: number;
  blob?: string;
}

const NO_ERROR = "No error";
const BAD_JSON_ERROR = "Bad JSON";
const DEFAULT_OUTPUT_PATH = '../tests/testcases/testcases_arbitrary_sign.json';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('output', {
      type: 'string',
      default: DEFAULT_OUTPUT_PATH,
      description: 'Output JSON file'
    })
    .parse();

  ensureOutputDirectoryExists(argv.output);
  
  // Define all protocol generators
  const protocolGenerators: ProtocolGenerator[] = [
    caip122Generator,
    fido2Generator
  ];
  
  // Generate test vectors from all generators
  const testVectors = generateVectorsFromGenerators(protocolGenerators);
  
  writeTestVectorsToFile(argv.output, testVectors);
}

/**
 * Ensures the output directory exists
 */
function ensureOutputDirectoryExists(outputPath: string): void {
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Writes test vectors to the specified file
 */
function writeTestVectorsToFile(outputPath: string, testVectors: any[]): void {
  fs.writeFileSync(outputPath, JSON.stringify(testVectors, null, 2));
}

function generateVectorsFromGenerators(generators: ProtocolGenerator[]): TestVector[] {
  let index = 0;
  const allTestVectors: TestVector[] = [];

  for (const generator of generators) {
    // Process valid configurations
    const validConfigs = generator.generateValidConfigs();
    const validTestVectors = processConfigs(validConfigs as TestConfig[], generator, index, true);
    index += validConfigs.length;
    
    // Find a complete valid config to use as a base for invalid tests
    const completeValidConfig = findCompleteValidConfig(validConfigs);
    
    // Process invalid configurations
    const invalidConfigs = generator.generateInvalidConfigs(completeValidConfig);
    const invalidTestVectors = processConfigs(invalidConfigs as TestConfig[], generator, index, false);
    index += invalidConfigs.length;

    // Generate a special test for JSON with whitespace
    const jsonWithWhiteSpaceTestVector = generateJsonWithWhiteSpaceTestVector(
      completeValidConfig as TestConfig, 
      generator, 
      index++
    );

    // Combine all test vectors
    allTestVectors.push(...validTestVectors, ...invalidTestVectors, jsonWithWhiteSpaceTestVector);
  }

  return allTestVectors;
}

/**
 * Process a set of configurations and create test vectors
 * @param configs The configurations to process
 * @param generator The protocol generator to use
 * @param startIndex Starting index for test vector numbering
 * @param isValid Whether these configs are expected to be valid
 * @returns Array of test vectors
 */
function processConfigs(
  configs: TestConfig[], 
  generator: ProtocolGenerator, 
  startIndex: number,
  isValid: boolean,
): TestVector[] {
  const testVectors: TestVector[] = [];
  let index = startIndex;
  
  for (const config of configs) {
    validateConfigError(config, isValid);
    
    // Create blob from config
    config.blob = createBlobFromConfig(config, generator);

    // Generate and add the test vector
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
 * Validates that a config has the expected error status
 */
function validateConfigError(config: TestConfig, isValid: boolean): void {
  if (isValid) {
    if (config.error !== NO_ERROR) {
      throw new Error(`Config error (${config.error}) should be "${NO_ERROR}"`);
    }
  } else {
    if (config.error === NO_ERROR) {
      throw new Error(`Config error (${config.error}) shouldn't be "${NO_ERROR}"`);
    }
  }
}

/**
 * Creates a blob from the given configuration
 */
function createBlobFromConfig(config: TestConfig, generator: ProtocolGenerator): string {
  const fieldNames = Object.values(FIELD_NAMES);
  const externalStartIdx = generator.findExternalFieldsStartIndex(config.fields, fieldNames);
  const data = generator.parseDataFields(config.fields, externalStartIdx);
  const dataBytes = Buffer.from(JSON.stringify(data), 'utf-8');
  return generator.createBlob(dataBytes, config.fields, config.index || 0);
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

/**
 * Generates a test vector with whitespace in the JSON
 */
function generateJsonWithWhiteSpaceTestVector(
  config: TestConfig,
  generator: ProtocolGenerator,
  index: number
): TestVector {
    // Create a deep copy of the config to avoid modifying the original
    const whiteSpaceConfig = JSON.parse(JSON.stringify(config));
    
    // Create a blob with whitespace in the JSON
    const fieldNames = Object.values(FIELD_NAMES);
    const externalStartIdx = generator.findExternalFieldsStartIndex(whiteSpaceConfig.fields, fieldNames);
    const data = generator.parseDataFields(whiteSpaceConfig.fields, externalStartIdx);
    const dataBytes = Buffer.from(JSON.stringify(data, null, 1), 'utf-8'); // Add whitespace
    
    // Override config values
    whiteSpaceConfig.blob = generator.createBlob(dataBytes, whiteSpaceConfig.fields, whiteSpaceConfig.index);
    whiteSpaceConfig.error = BAD_JSON_ERROR;
    whiteSpaceConfig.name = `${whiteSpaceConfig.name}_json_with_white_space`;

    return generateTestVector(
      index,
      whiteSpaceConfig.name,
      whiteSpaceConfig.blob,
      whiteSpaceConfig.fields,
      whiteSpaceConfig.error
    );
}

if (require.main === module) {
  main().catch(console.error);
}