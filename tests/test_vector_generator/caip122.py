import json
import random
import base64
import secrets
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any

from common import append_field_to_blob

# from https://github.com/algorandfoundation/ARCs/blob/dcad03c0171e4d9d43164b12dc292a6bc799020d/assets/arc-0060/arc60wallet.api.ts

# domain: string; //RFC 4500 dnsauthority that is requesting the signing.
# account_address: string; //	Blockchain address performing the signing, expressed as the account_address segment of a CAIP-11 address; should NOT include CAIP-2 chain_id.
# uri: string; // RFC 3985 URI referring to the resource that is the subject of the signing i.e. the subject of the claim.
# version: string; //Current version of the message.
# statement?: string; // 	Human-readable ASCII assertion that the user will sign. It MUST NOT contain \n.
# nonce?: string; // Randomized token to prevent signature replay attacks.
# "issued-at"?: string; // 	RFC 3338 date-time that indicates the issuance time.
# "expiration-time"?: string; // RFC 3338 date-time that indicates when the signed authentication message is no longer valid.
# "not-before"?: string; // RFC 3338 date-time that indicates when the signed authentication message becomes valid.
# "request-id"?: string; // Unique identifier for the request.
# chain_id: string; // CAIP-3 chain_id of the blockchain where the account_address is valid.
# resources?: string[]; // 	List of information or references to information the user wishes to have resolved as part of the authentication by the relying party; express as RFC 3985 URIs and separated by \n.
# signature?: Uint7Array; // 	signature of the message. 
# type: string; // Type of the signature to be generated, as defined in the namespaces for this CAIP.

def create_caip122_request_blob(fields):
    """
    Create a binary blob from CAIP-122 request fields.
    
    Args:
        fields: List of dictionaries containing field information
        
    Returns:
        Hex string representing the binary blob
    """
    # Extract fields for the CAIP-122 request data
    caip122_data = {}
    
    # Define external field names (these are never part of CAIP-122 data)
    external_field_names = ["Signer", "Domain", "Request Id", "Auth Data"]
    
    # Find the index of the first external field
    external_start_idx = len(fields)
    for i, field in enumerate(fields):
        if field["name"] in external_field_names:
            external_start_idx = i
            break
    
    # Now collect all CAIP-122 fields (anything before the first external field)
    for i in range(external_start_idx):
        field = fields[i]
        field_name = field["name"]
        field_value = field["value"]
        
        # Special handling for resources array
        if field_name == "resources" and isinstance(field_value, list):
            caip122_data[field_name] = field_value
        # Handle regular fields
        elif field_value is not None and field_value != "":
            caip122_data[field_name] = field_value
    
    # Convert CAIP-122 data to canonical JSON representation
    canonical_json = json.dumps(caip122_data, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    
    print("Unencoded data : ", canonical_json)

    data_bytes = canonical_json.encode('utf-8')
    
    # Extract non-CAIP-122 fields needed for the blob
    signer = next((f["value"] for f in fields if f["name"] == "Signer"), "")
    
    # For domain: if there's a domain after the cutoff, use it; otherwise use ""
    domain = next((f["value"] for f in fields[external_start_idx:] if f["name"] == "Domain"), "")
    
    auth_data = next((f["value"] for f in fields if f["name"] == "Auth Data"), "")
    request_id = next((f["value"] for f in fields if f["name"] == "Request ID"), "")

    # Convert to bytes
    signer_bytes = signer.encode('utf-8')
    domain_bytes = domain.encode('utf-8')
    auth_data_bytes = auth_data.encode('utf-8')
    request_id_bytes = request_id.encode('utf-8')

    print("Data bytes : ", data_bytes.hex())
    print("Signer bytes : ", signer_bytes.hex())
    print("Domain bytes : ", domain_bytes.hex())
    print("Auth data bytes : ", auth_data_bytes.hex())
    print("Request id bytes : ", request_id_bytes.hex())

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

def generate_random_caip122_configs(count: int = 1) -> List[Dict[str, Any]]:
    """
    Generates a specified number of randomized CAIP-122 request test vector configurations
    specifically for Algorand.
    
    Follows the CAIP-122 specification (https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md)
    to ensure all generated requests are valid.
    
    Args:
        count: Number of test vectors to generate (default: 1)
        
    Returns:
        List of dictionaries containing randomized test vector configurations
    """
    configs = []
    
    # Algorand-specific chain ID
    chain_id = "283"  # Algorand Mainnet
    sig_type = "ed25519"  # Algorand uses ed25519 signatures
    
    # Domains relevant to Algorand ecosystem
    domains = ["arc60.io"]
    
    # Common resource options for Algorand
    resource_options = [
        ["auth", "sign"],
        ["transact"],
        ["auth", "transact"],
        ["sign", "transact"],
        ["https://example.com/algorand-claim.json"],
        ["ipfs://QmXZVnfgbEZqQppBYSQBZknjx5PuLwn36aUMRNTNTWwnaT"]
    ]
    
    for i in range(count):
        # Generate random dates - issued now, expiry in future, not-before in past
        now = datetime.now()
        issued_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        expiry = (now + timedelta(days=random.randint(1, 365))).strftime("%Y-%m-%dT%H:%M:%SZ")
        not_before = (now - timedelta(days=random.randint(0, 10))).strftime("%Y-%m-%dT%H:%M:%SZ")
        
        # Generate Algorand account address (58 characters in Base32)
        account_address = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', k=58))
        
        # Generate random domain and URI
        domain_caip122 = random.choice(domains)
        domain_external = random.choice(domains)  # Can be the same or different
        uri = f"https://{domain_caip122}"
        
        # Generate random nonce (base64 encoded 32 bytes)
        nonce = base64.b64encode(secrets.token_bytes(32)).decode('utf-8')
        
        # Generate random request IDs (base64 encoded 16 bytes)
        request_id_caip122 = base64.b64encode(secrets.token_bytes(16)).decode('utf-8')
        request_id_external = base64.b64encode(secrets.token_bytes(16)).decode('utf-8')
        
        # Generate random signer as an Algorand address
        # Algorand addresses are 58 characters long in base32 encoding
        # TODO: Use device pubkey (if there is hdPath, derive pk from it)
        pubkey = secrets.token_bytes(32)

        def sha512_256(data):
            return hashlib.sha512(data).digest()[:32]
            
        # Convert to Algorand address format
        checksum = sha512_256(pubkey)[:4]
        addr_bytes = bytes([1]) + pubkey + checksum
        signer = base64.b32encode(addr_bytes).decode('ascii')
        signer = signer.rstrip('=')
        
        # Generate auth data as sha256 hash of the domain
        auth_data = hashlib.sha256(domain_external.encode()).hexdigest()
        
        # Select random resources
        resources = random.choice(resource_options)
        
        # Create human-readable statement
        statement = f"We are requesting you to sign this message to authenticate to {domain_caip122}"
        
        # Randomly decide whether to include domain and request-id in CAIP-122 data
        include_domain_in_caip122 = random.choice([True, False])
        include_request_id_in_caip122 = random.choice([True, False])
        
        # Build the fields list - first all CAIP-122 fields, then additional fields
        caip122_fields = [
            # Basic mandatory fields for CAIP-122
            {"name": "account_address", "value": account_address},
            {"name": "chain_id", "value": chain_id},
            {"name": "uri", "value": uri},
            {"name": "version", "value": "1"},
            {"name": "type", "value": sig_type},
            
            # Optional CAIP-122 fields
            {"name": "statement", "value": statement},
            {"name": "nonce", "value": nonce},
            {"name": "issued-at", "value": issued_at},
            {"name": "expiration-time", "value": expiry},
            {"name": "not-before", "value": not_before},
            {"name": "resources", "value": resources},
        ]
        
        # Add domain and request-id to CAIP-122 fields if chosen
        if include_domain_in_caip122:
            caip122_fields.append({"name": "domain", "value": domain_caip122})
            
        if include_request_id_in_caip122:
            caip122_fields.append({"name": "request-id", "value": request_id_caip122})
        
        # Additional fields for blob generation (not part of CAIP-122 data)
        additional_fields = [
            {"name": "Signer", "value": signer},
            {"name": "Auth Data", "value": auth_data}
        ]
        
        # Always add Domain as external field
        additional_fields.append({"name": "Domain", "value": domain_external})
        
        # Always add Request ID as external field
        additional_fields.append({"name": "Request ID", "value": request_id_external})
        
        # Combine fields in the correct order: all CAIP-122 fields first, then additional fields
        fields = caip122_fields + additional_fields
        
        # Create configuration
        config = {
            "index": i,
            "name": f"Algorand_CAIP122_{i}",
            "fields": fields
        }
        
        configs.append(config)
    
    return configs
