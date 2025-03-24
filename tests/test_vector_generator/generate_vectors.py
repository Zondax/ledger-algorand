#!/usr/bin/env python3
import argparse
import json
import os
import sys
# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common import generate_test_vector
from caip122 import (
    create_caip122_request_blob,
    generate_random_caip122_configs,
)
from fido2 import (
    create_fido2_request_blob,
    generate_random_fido2_configs,
)

def main():
    parser = argparse.ArgumentParser(description='Generate test vectors for Algorand transactions')
    parser.add_argument('--output', type=str, default='../testcases_arbitrary_sign.json', 
                        help='Output JSON file')
    parser.add_argument('--count', type=int, default=1, 
                        help='Number of random test vectors to generate per type (CAIP-122 and FIDO2)')
    args = parser.parse_args()
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    test_vectors = []
    
    # Always generate both CAIP-122 and FIDO2 test vectors
    
    # Generate CAIP-122 test vectors
    caip122_config = generate_random_caip122_configs(args.count)
    for vector_config in caip122_config:
        # Generate the blob if it doesn't exist
        if "blob" not in vector_config or not vector_config["blob"]:
            vector_config["blob"] = create_caip122_request_blob(vector_config["fields"])
            
        test_vector = generate_test_vector(
            index=vector_config["index"],
            name=vector_config["name"],
            blob=vector_config["blob"],
            fields=vector_config["fields"]
        )
        test_vectors.append(test_vector)
    
    # Generate FIDO2 test vectors
    fido2_config = generate_random_fido2_configs(args.count)
    # Adjust indices to continue from CAIP-122 vectors
    offset = len(test_vectors)
    
    for i, vector_config in enumerate(fido2_config):
        # Generate the blob if it doesn't exist
        if "blob" not in vector_config or not vector_config["blob"]:
            vector_config["blob"] = create_fido2_request_blob(vector_config["fields"])
            
        test_vector = generate_test_vector(
            index=offset + i,
            name=vector_config["name"],
            blob=vector_config["blob"],
            fields=vector_config["fields"]
        )
        test_vectors.append(test_vector)
    
    with open(args.output, 'w') as f:
        json.dump(test_vectors, f, indent=2)

if __name__ == "__main__":
    main() 