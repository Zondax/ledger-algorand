import json
import struct
from typing import List, Dict, Any

def generate_test_vector(
    index: int,
    name: str,
    blob: str,
    fields: List[Dict[str, str]],
    expert_mode: bool = False
) -> Dict[str, Any]:
    """
    Generate a test vector with the specified parameters.
    
    Args:
        index: The test vector index
        name: The test vector name
        blob: The test vector blob (hex string)
        fields: List of dictionaries containing field information
        expert_mode: Whether to generate different expert output
        
    Returns:
        Dictionary containing the test vector
    """
    output = []
    MAX_CHARS_PER_LINE = 38  # Define max characters per line
    
    for i, field in enumerate(fields):
        field_name = field["name"]
        field_value = field["value"]
        
        # Automatically split if the value is longer than max chars
        if len(field_value) > MAX_CHARS_PER_LINE:
            value_chunks = []
            remaining = field_value
            
            while remaining:
                if len(remaining) <= MAX_CHARS_PER_LINE:
                    value_chunks.append(remaining)
                    remaining = ""
                else:
                    value_chunks.append(remaining[:MAX_CHARS_PER_LINE])
                    remaining = remaining[MAX_CHARS_PER_LINE:]
            
            total_chunks = len(value_chunks)
            for line_num, chunk in enumerate(value_chunks):
                output.append(f"{i} | {field_name} [{line_num+1}/{total_chunks}] : {chunk}")
        else:
            output.append(f"{i} | {field_name} : {field_value}")
    
    # Expert output is always the same as regular output
    output_expert = output.copy()
    
    return {
        "index": index,
        "name": name,
        "blob": blob,
        "output": output,
        "output_expert": output_expert
    }

def append_field_to_blob(blob: bytearray, field_bytes: bytes) -> None:
    """
    Append a field to a blob with correct length prefix
    
    Args:
        blob: The bytearray to append to
        field_bytes: The bytes to append
    """
    length = len(field_bytes)
    blob.extend(struct.pack('>I', length))  # UInt32BE length prefix
    blob.extend(field_bytes)