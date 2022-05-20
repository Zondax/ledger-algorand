#include "command_handler.h"
#include "algo_ui.h"
#include "algo_addr.h"
#include "algo_keys.h"

// #include "apdu_protocol_defines.h"
#include "app_main.h"

/*
* this function validated the input of the APDU command buffer.
* and extract the account id from the buffer.
* if the input doesn't contain an account id, the returend account id is 0
*/

zxerr_t parse_input_for_get_public_key_command(const uint8_t* buffer, const uint32_t buffer_len, uint32_t* output_account_id)
{
  *output_account_id = 0;

  if (buffer_len <= OFFSET_DATA_LEN)
  {
    PRINTF("using default account id 0 ");
    return zxerr_ok;
  }

  uint8_t lc = buffer[OFFSET_DATA_LEN];
  if (lc == 0)
  {
    PRINTF("using default account id 0 ");
    return zxerr_ok;
  }

  if (lc < sizeof(uint32_t))
  {
    //{FT} check this error code
    // return 0x6a86;
    return zxerr_encoding_failed;
  }

  if (buffer_len < lc + OFFSET_DATA)
  {
    //{FT} check this error code
    // return 0x6a87;
    return zxerr_encoding_failed;
  }
  *output_account_id = U4BE(buffer, OFFSET_DATA);

  return zxerr_ok;
}

/*
* This function parses the input buffer (from the application) and tries to construct
* the txn_output.
* this function might be called multiple times. each time the function will fill the
* current_txn_buffer untill the end of the input.
* the function will throw 0x9000 when more data is needed to decode the transaction.
* if a decode error occucrs the fuction returns non null value.
*/

int parse_input_for_msgpack_command(const uint8_t* data_buffer, const uint32_t buffer_len,
                                    uint8_t* current_txn_buffer, const uint32_t current_txn_buffer_size,
                                    uint32_t *current_txn_buffer_offset, txn_t* txn_output,
                                    char **error_msg)
{
  const uint8_t *cdata = data_buffer + OFFSET_DATA;
  //Payload length
  uint8_t lc = data_buffer[OFFSET_DATA_LEN];

  if (lc == 0) {
    // APDU msgpack wrong size
    return 0x6a84;
  }

  if (buffer_len < lc + OFFSET_DATA) {
    // buffer too small
    return 0x6a85;
  }

  if ((data_buffer[OFFSET_P1] & 0x80) == P1_FIRST)
  {
    // Payload length = 4-byte accountId + Chuck_00
    memset(txn_output, 0, sizeof(*txn_output));
    *current_txn_buffer_offset = 0;
    txn_output->accountId = 0;
    if (data_buffer[OFFSET_P1] & P1_WITH_ACCOUNT_ID)
    {
      parse_input_for_get_public_key_command(data_buffer, buffer_len, &txn_output->accountId);
      ZEMU_LOGF(200, "Signing the transaction using account id: %d\n", txn_output->accountId);

      //Replace with this: txn_output->accountId
      cdata += sizeof(uint32_t);
      lc -= sizeof(uint32_t);
    }
  }

  if (*current_txn_buffer_offset + lc > current_txn_buffer_size) {
    //Buffer to small
    return APDU_CODE_WRONG_LENGTH;
  }

  //lc size is now (payload - accountId) bytes (for first block only)
  MEMMOVE(current_txn_buffer + *current_txn_buffer_offset, cdata, lc);
  *current_txn_buffer_offset += lc;

  switch (data_buffer[OFFSET_P2]) {
    case P2_LAST:
      break;
    case P2_MORE:
      return APDU_CODE_OK;
    default:
      return APDU_CODE_INVALIDP1P2;
  }

  //parser data
  *error_msg = tx_decode(current_txn_buffer, *current_txn_buffer_offset, txn_output);
  if (*error_msg != NULL) {
    PRINTF("got error from decoder:\n");
    PRINTF("%s\n", *error_msg);
  }

  return 0;
}
