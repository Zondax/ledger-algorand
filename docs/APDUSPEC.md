# Algorand App

## General structure

The general structure of commands and responses is as follows:

### Commands

| Field   | Type     | Content                | Note |
| :------ | :------- | :--------------------- | ---- |
| CLA     | byte (1) | Application Identifier | 0x80 |
| INS     | byte (1) | Instruction ID         |      |
| P1      | byte (1) | Parameter 1            |      |
| P2      | byte (1) | Parameter 2            |      |
| L       | byte (1) | Bytes in payload       |      |
| PAYLOAD | byte (L) | Payload                |      |

### Response

| Field   | Type     | Content     | Note                     |
| ------- | -------- | ----------- | ------------------------ |
| ANSWER  | byte (?) | Answer      | depends on the command   |
| SW1-SW2 | byte (2) | Return code | see list of return codes |

### Return codes

| Return code | Description             |
| ----------- | ----------------------- |
| 0x6400      | Execution Error         |
| 0x6982      | Empty buffer            |
| 0x6983      | Output buffer too small |
| 0x6984      | Data invalid            |
| 0x6986      | Command not allowed     |
| 0x6987      | Tx not initialized      |
| 0x6D00      | INS not supported       |
| 0x6E00      | CLA not supported       |
| 0x6F00      | Unknown                 |
| 0x9000      | Success                 |

---

## Command definition

### GET_VERSION

#### Command

| Field | Type     | Content                | Expected |
| ----- | -------- | ---------------------- | -------- |
| CLA   | byte (1) | Application Identifier | 0x80     |
| INS   | byte (1) | Instruction ID         | 0x00     |
| P1    | byte (1) | Parameter 1            | ignored  |
| P2    | byte (1) | Parameter 2            | ignored  |
| L     | byte (1) | Bytes in payload       | 0        |

#### Response

| Field   | Type     | Content          | Note                            |
| ------- | -------- | ---------------- | ------------------------------- |
| TEST    | byte (1) | Test Mode        | 0xFF means test mode is enabled |
| MAJOR   | byte (2) | Version Major    | 0..65535                        |
| MINOR   | byte (2) | Version Minor    | 0..65535                        |
| PATCH   | byte (2) | Version Patch    | 0..65535                        |
| LOCKED  | byte (1) | Device is locked |                                 |
| SW1-SW2 | byte (2) | Return code      | see list of return codes        |

---

### INS_GET_PUBLIC_KEY

#### Command

| Field   | Type     | Content                   | Expected  |
| ------- | -------- | ------------------------- | --------- |
| CLA     | byte (1) | Application Identifier    | 0x80      |
| INS     | byte (1) | Instruction ID            | 0x03      |
| P1      | byte (1) | Request User confirmation | No = 0    |
| P2      | byte (1) | Parameter 2               | ignored   |
| LC      | byte (1) | Bytes in payload          | (depends) |
| Payload | byte (4) | Account ID                | (depends) |

The account number is used to derive keys from BIP32 path `44'/283'/<account>'/0/0`
(note that the account number is hardened as shown by the `'` sign). Account number defaults
to `0x0` in the case of APDU with empty payload.

#### Response

| Field     | Type      | Content     | Note                     |
| --------- | --------- | ----------- | ------------------------ |
| PublicKey | byte (65) | Public Key  |                          |
| Address   | byte (58) | Address     |                          |
| SW1-SW2   | byte (2)  | Return code | see list of return codes |

---

### INS_SIGN_MSGPACK

#### Command

| Field   | Type       | Content                   | Expected  |
| ------- | ---------- | ------------------------- | --------- |
| CLA     | byte (1)   | Application Identifier    | 0x80      |
| INS     | byte (1)   | Instruction ID            | 0x08      |
| P1      | byte (1)   | Request User confirmation | (depends) |
| P2      | byte (1)   | Parameter 2               | (depends) |
| LC      | byte (1)   | Bytes in payload          | (depends) |
| Payload | byte (var) | AccID + MsgPack Chunks    | (depends) |

If one single APDU may contain a whole transaction, `P1` and `P2` are both `0x00`.

New format enhances messaging with an optional account number that must be inserted
in the first chunk of the sequence. As an optional payload, bit `0` of field `P1` in
the first chunk must be set if present in the message.

And as for `INS_GET_PUBLIC_KEY` instruction, it is a big-endian encoded 32-bit
unsigned integer word.

The resulting sequence of chunks is as follows:

First APDU message

| CLA  | INS  | P1   | P2   | LC  | Payload                    |
| ---- | ---- | ---- | ---- | --- | -------------------------- |
| 0x80 | 0x08 | 0x01 | 0x80 | N1  | account + MsgPack chunk #1 |

...

APDU message i

| CLA  | INS  | P1   | P2   | LC  | Payload          |
| ---- | ---- | ---- | ---- | --- | ---------------- |
| 0x80 | 0x08 | 0x80 | 0x80 | Ni  | MsgPack chunk #i |

...

Last APDU message

| CLA  | INS  | P1   | P2   | LC  | Payload          |
| ---- | ---- | ---- | ---- | --- | ---------------- |
| 0x80 | 0x08 | 0x80 | 0x00 | NI  | MsgPack chunk #I |

#### Response

| Field     | Type      | Content        | Note                     |
| --------- | --------- | -------------- | ------------------------ |
| Signature | byte (64) | Signed message |                          |
| SW1-SW2   | byte (2)  | Return code    | see list of return codes |

If one signle APDU is needed for the whole transaction along with the account number,
`P1` and `P2` are `0x01` and `0x00` respectively.

| CLA  | INS  | P1   | P2   | LC  | Payload               |
| ---- | ---- | ---- | ---- | --- | --------------------- |
| 0x80 | 0x08 | 0x01 | 0x00 | N1  | account + MsgPack txn |

If the account number is not inserted within the message, the former message format is used
(`P1` in the first chunk is `0x00`) and the account number defaults to `0x00` for the transaction
signature.

| CLA  | INS  | P1   | P2   | LC  | Payload     |
| ---- | ---- | ---- | ---- | --- | ----------- |
| 0x80 | 0x08 | 0x00 | 0x00 | N1  | MsgPack txn |

### INS_SIGN_ARBITRARY_DATA

#### Command

| Field   | Type       | Content                 | Expected  |
| ------- | ---------- | ----------------------- | --------- |
| CLA     | byte (1)   | Application Identifier  | 0x80      |
| INS     | byte (1)   | Instruction ID          | 0x10      |
| P1      | byte (1)   | First/More/Last         | (depends) |
| P2      | byte (1)   | N/A                     | 0x00      |
| LC      | byte (1)   | Bytes in payload        | (depends) |
| Payload | byte (var) | hdPath + Arbitrary data | (depends) |

First APDU message (only contains hdPath)

| CLA  | INS  | P1   | P2   | LC  | Payload |
| ---- | ---- | ---- | ---- | --- | ------- |
| 0x80 | 0x10 | 0x00 | 0x00 | N1  | hdPath  |

APDU message `i`

| CLA  | INS  | P1   | P2   | LC  | Payload             |
| ---- | ---- | ---- | ---- | --- | ------------------- |
| 0x80 | 0x10 | 0x01 | 0x00 | Ni  | Arb. data chunk `i` |

Last APDU message

| CLA  | INS  | P1   | P2   | LC  | Payload              |
| ---- | ---- | ---- | ---- | --- | -------------------- |
| 0x80 | 0x10 | 0x02 | 0x00 | NI  | Arb. data last chunk |

##### Arbitrary Data Chunks

| Field                  | Restrictions             | Max Size (bytes) |
| ---------------------- | ------------------------ | ---------------- |
| Signer                 | -                        | 32               |
| Scope                  | see Supported Scopes     | 1                |
| Encoding               | see Supported Encodings  | 1                |
| Data Len               |                          | 2                |
| Data                   | Canonical JSON           | 511              |
| Domain Len             |                          | 2                |
| Domain                 | Representable ASCII      | 255              |
| Request ID Len         |                          | 2                |
| Request ID             |                          | 255              |
| Authenticated Data Len |                          | 2                |
| Authenticated Data     |                          | 256              |

##### Supported Scopes

- AUTH : 1

##### Supported Encodings

- Base64 : 1

### Checks performed by the wallet

- Signer is a raw Public Key (Hex String)
  - Algorand Address not allowed
- Authenticated Data's first 32 bytes must be equal to sha256(Domain)
- Domain is representable ASCII (Values in range 33..126, both included)
- Data is a canonical JSON
- hdPath is BIP44 and starts with 44'/283'
- hdPath hardening restrictions

#### Response

##### OK

| Field     | Type      | Content                                            |
| --------- | --------- | -------------------------------------------------- |
| Signature | byte (64) | Signed [sha256(data) + sha256(Authenticated Data)] |
| SW1-SW2   | byte (2)  | 0x9000                                             |

##### Error

| Field   | Type     | Content     | Note                            |
| ------- | -------- | ----------- | ------------------------------- |
| SW1-SW2 | byte (2) | Return code | see Arbitrary Sign Return Codes |

### Arbitrary Sign Return codes

| Return code | Description                  |
| ----------- | ---------------------------- |
| 0x6400      | Execution Error              |
| 0x6982      | Empty buffer                 |
| 0x6983      | Output buffer too small      |
| 0x6986      | Command not allowed          |
| 0x6988      | Invalid scope                |
| 0x6989      | Failed decoding              |
| 0x698A      | Invalid signer               |
| 0x698B      | Missing domain               |
| 0x698C      | Missing authenticated data   |
| 0x698D      | Bad JSON                     |
| 0x698E      | Failed domain authentication |
| 0x698F      | Failed HD path               |
| 0x6D00      | INS not supported            |
| 0x6E00      | CLA not supported            |
| 0x6F00      | Unknown                      |
| 0x9000      | Success                      |

---
