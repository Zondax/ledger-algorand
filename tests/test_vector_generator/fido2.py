import json
import random
import base64
import secrets
import hashlib
from typing import List, Dict, Any

from common import append_field_to_blob

def create_fido2_request_blob(fields):
    """
    Create a binary blob from FIDO2/WebAuthn request fields.
    
    Args:
        fields: List of dictionaries containing field information
        
    Returns:
        Hex string representing the binary blob
    """
    # Extract FIDO2 fields
    fido2_data = {}
    
    # Define external field names (these are never part of FIDO2 data)
    external_field_names = ["Signer", "Domain", "Request ID", "Auth Data"]
    
    # Find the index of the first external field
    external_start_idx = len(fields)
    for i, field in enumerate(fields):
        if field["name"] in external_field_names:
            external_start_idx = i
            break
    
    # Now collect all FIDO2 fields (anything before the first external field)
    for i in range(external_start_idx):
        field = fields[i]
        field_name = field["name"]
        field_value = field["value"]
        
        # Handle field values based on their types
        if field_value.isdigit():
            fido2_data[field_name] = int(field_value)
        elif field_value.lower() in ['true', 'false']:
            fido2_data[field_name] = field_value.lower() == 'true'
        else:
            fido2_data[field_name] = field_value
    
    # Convert FIDO2 data to canonical JSON representation
    canonical_json = json.dumps(fido2_data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    data_bytes = canonical_json.encode('utf-8')
    
    # Extract non-FIDO2 fields needed for the blob
    signer = next((f["value"] for f in fields if f["name"] == "Signer"), "")
    auth_data = next((f["value"] for f in fields if f["name"] == "Auth Data"), "")
    request_id = next((f["value"] for f in fields if f["name"] == "Request ID"), "")
    domain = next((f["value"] for f in fields if f["name"] == "Domain"), "")

    # Convert to bytes
    signer_bytes = bytes.fromhex(signer)
    auth_data_bytes = bytes.fromhex(auth_data)
    request_id_bytes = request_id.encode('utf-8')
    domain_bytes = domain.encode('utf-8')

    # Create buffer for the blob
    blob = bytearray()
    
    # Append each field in the required order
    append_field_to_blob(blob, data_bytes)
    append_field_to_blob(blob, signer_bytes)
    append_field_to_blob(blob, domain_bytes)
    append_field_to_blob(blob, auth_data_bytes)
    append_field_to_blob(blob, request_id_bytes)
    
    # Convert blob to hex string
    hex_blob = blob.hex()
    
    return hex_blob

def generate_random_fido2_configs(count: int = 1) -> List[Dict[str, Any]]:
    """
    Generates a specified number of randomized FIDO2/WebAuthn request test vector configurations
    specifically for Algorand.
    
    Args:
        count: Number of test vectors to generate (default: 1)
        
    Returns:
        List of dictionaries containing randomized test vector configurations
    """
    configs = []
    
    # Common domains relevant to Algorand ecosystem
    domains = ["webauthn.io"]
    
    # Possible request types
    request_types = ["webauthn.create", "webauthn.get"]
    
    for i in range(count):
        # Generate random domain for origin
        domain = random.choice(domains)
        origin = f"https://{domain}"
        
        # Generate random challenge (base64 encoded 32 bytes)
        challenge = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
        
        # Generate random signer (hex string of 32 bytes)
        # TODO: Use device pubkey (if there is hdPath, derive pk from it)
        signer = secrets.token_hex(32)
        
        # Generate random request ID (base64 encoded 16 bytes)
        request_id = base64.b64encode(secrets.token_bytes(16)).decode('utf-8')
        
        # Generate auth data as sha256 hash of the domain
        auth_data = hashlib.sha256(domain.encode()).hexdigest()
        
        # Create base fields for FIDO2 request (required fields)
        fido2_data = {
            "origin": origin,
            "challenge": challenge,
        }
        
        # Add optional fields with probability
        if random.choice([True, False]):
            fido2_data["type"] = random.choice(request_types)
            
        if random.choice([True, False]):
            fido2_data["rpId"] = domain
            
        if random.choice([True, False]):
            # Generate random userId (base64 encoded 16 bytes)
            fido2_data["userId"] = base64.b64encode(secrets.token_bytes(16)).decode('utf-8')
            
        if random.choice([True, False]):
            fido2_data["timeout"] = random.randint(30000, 600000)  # timeout in milliseconds
            
        if random.choice([True, False]):
            # Simple extension example
            fido2_data["extensions"] = {"appid": f"https://{domain}/app"}
        
        # Build fields list
        fields = []
        
        # Add each field from the JSON object individually
        for key, value in fido2_data.items():
            fields.append({"name": key, "value": str(value)})
            
        # Additional fields for blob generation
        fields.extend([
            {"name": "Signer", "value": signer},
            {"name": "Domain", "value": domain},
            {"name": "Request ID", "value": request_id},
            {"name": "Auth Data", "value": auth_data}
        ])
        
        # Create configuration
        config = {
            "index": i,
            "name": f"Algorand_FIDO2_{i}",
            "fields": fields
        }
        
        configs.append(config)
    
    return configs