interface Field {
  name: string;
  value: string;
}

interface TestVector {
  index: number;
  name: string;
  blob: string;
  valid: boolean;
  output: string[];
  output_expert: string[];
}

export enum Scope {
  AUTH = 0x01,
}

export enum Encoding {
  BASE64 = 0x01,
}


export function generateTestVector(
  index: number,
  name: string,
  blob: string,
  fields: Field[],
  expertMode: boolean = false,
  valid: boolean = true
): TestVector {
  const output: string[] = [];
  const MAX_CHARS_PER_LINE = 38;

  fields.forEach((field, i) => {
    const fieldName = field.name;
    const fieldValue = field.value;

    if (fieldValue.length > MAX_CHARS_PER_LINE) {
      const valueChunks: string[] = [];
      let remaining = fieldValue;

      while (remaining) {
        if (remaining.length <= MAX_CHARS_PER_LINE) {
          valueChunks.push(remaining);
          remaining = "";
        } else {
          valueChunks.push(remaining.slice(0, MAX_CHARS_PER_LINE));
          remaining = remaining.slice(MAX_CHARS_PER_LINE);
        }
      }

      const totalChunks = valueChunks.length;
      valueChunks.forEach((chunk, lineNum) => {
        output.push(`${i} | ${fieldName} [${lineNum + 1}/${totalChunks}] : ${chunk}`);
      });
    } else {
      output.push(`${i} | ${fieldName} : ${fieldValue}`);
    }
  });

  const outputExpert = [...output];

  return {
    index,
    name,
    blob,
    valid,
    output,
    output_expert: outputExpert
  };
}

// Updated function to correctly handle the buffer as an array
export function appendFieldToBlob(blob: number[], fieldBytes: number[]): void {
  // Create a buffer for length (UInt32BE)
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(fieldBytes.length);
  
  // Append length and field bytes to the blob
  blob.push(...Array.from(lengthBuffer));
  blob.push(...fieldBytes);
}