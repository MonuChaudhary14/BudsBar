/**
 * Airoha / realme RACE Protocol Parser & Packet Builder
 * Reconstructed from realme Link APK (com.realme.link)
 * 
 * Supports:
 * - Battery telemetry (Left, Right, Case)
 * - Active Noise Cancellation (ANC: Cancel, Transparency, Off)
 * - Low-Latency Game Mode (45ms)
 * - Hardware Sound Effects / EQ Presets
 */

// Airoha GATT Service and Characteristic UUIDs reversed from APK
export const BLE_SERVICES = {
  AIROHA_PRIMARY: '5052494d-2dab-0341-6972-6f6861424c45', // PRIM-..AirohaBLE
  AIROHA_WRITE: '43484152-2dab-3141-6972-6f6861424c45',   // CHAR-..1AirohaBLE
  AIROHA_NOTIFY: '43484152-2dab-3241-6972-6f6861424c45',  // CHAR-..2AirohaBLE
  HEYMELODY_SERVICE: 'db764ac8-4b08-7f25-aafe-59d03c27bae3',
  HEYMELODY_CHAR: 'db764ac8-4b08-7f25-aafe-59d03c27bae4'
};

// RACE Magic Bytes & Command Identifiers
export const RACE_CONSTANTS = {
  HEADER_REQUEST: [0x05, 0x5a],
  HEADER_RESPONSE: [0x05, 0x5b],
  
  // RACE Opcodes
  OPCODE_GET_BATTERY: 0x0c02,
  OPCODE_SET_ANC_MODE: 0x0c18,
  OPCODE_GET_ANC_MODE: 0x0c19,
  OPCODE_SET_GAME_MODE: 0x0c0b,
  OPCODE_GET_GAME_MODE: 0x0c0c,
  OPCODE_SET_EQ_PRESET: 0x0c25,
  OPCODE_GET_EQ_PRESET: 0x0c26,

  // ANC States
  ANC_OFF: 0x00,
  ANC_CANCELLATION: 0x01,
  ANC_TRANSPARENCY: 0x02,

  // EQ Modes
  EQ_BALANCED: 0x00,
  EQ_BASS_BOOST: 0x01,
  EQ_CLEAR_VOCAL: 0x02,
  EQ_BRIGHT: 0x03
};

/**
 * Builds a valid Airoha RACE packet buffer
 * Format: [0x05, 0x5A] + [Length Hi, Length Lo] + [Opcode Hi, Opcode Lo] + [Payload...]
 */
export function buildRacePacket(opcode, payload = []) {
  const length = 2 + payload.length; // Opcode (2) + payload
  const buffer = new Uint8Array(4 + length);

  buffer[0] = RACE_CONSTANTS.HEADER_REQUEST[0];
  buffer[1] = RACE_CONSTANTS.HEADER_REQUEST[1];
  buffer[2] = (length >> 8) & 0xff;
  buffer[3] = length & 0xff;
  buffer[4] = (opcode >> 8) & 0xff;
  buffer[5] = opcode & 0xff;

  for (let i = 0; i < payload.length; i++) {
    buffer[6 + i] = payload[i];
  }

  return buffer;
}

/**
 * Generates an ANC mode change packet
 */
export function buildAncPacket(ancMode) {
  // 0: Off, 1: Noise Cancellation, 2: Transparency
  return buildRacePacket(RACE_CONSTANTS.OPCODE_SET_ANC_MODE, [ancMode]);
}

/**
 * Generates a Game Mode toggle packet
 */
export function buildGameModePacket(enabled) {
  return buildRacePacket(RACE_CONSTANTS.OPCODE_SET_GAME_MODE, [enabled ? 0x01 : 0x00]);
}

/**
 * Generates an EQ Preset change packet
 */
export function buildEqPacket(eqPresetIndex) {
  return buildRacePacket(RACE_CONSTANTS.OPCODE_SET_EQ_PRESET, [eqPresetIndex]);
}

/**
 * Parses incoming RACE response packets from earbuds
 */
export function parseRacePacket(data) {
  if (!data || data.length < 6) return null;
  
  const isHeader = (data[0] === 0x05 && (data[1] === 0x5a || data[1] === 0x5b));
  if (!isHeader) return null;

  const length = (data[2] << 8) | data[3];
  const opcode = (data[4] << 8) | data[5];
  const payload = data.slice(6, 6 + (length - 2));

  switch (opcode) {
    case RACE_CONSTANTS.OPCODE_GET_BATTERY: {
      // Typically: [LeftPct, RightPct, CasePct, StatusFlags]
      return {
        type: 'battery',
        left: payload[0] !== undefined ? payload[0] : 100,
        right: payload[1] !== undefined ? payload[1] : 100,
        case: payload[2] !== undefined ? payload[2] : 100,
        isChargingLeft: Boolean(payload[3] & 0x01),
        isChargingRight: Boolean(payload[3] & 0x02),
        isChargingCase: Boolean(payload[3] & 0x04)
      };
    }
    case RACE_CONSTANTS.OPCODE_GET_ANC_MODE:
    case RACE_CONSTANTS.OPCODE_SET_ANC_MODE: {
      const mode = payload[0];
      return {
        type: 'anc',
        mode: mode === 1 ? 'cancellation' : (mode === 2 ? 'transparency' : 'off')
      };
    }
    case RACE_CONSTANTS.OPCODE_GET_GAME_MODE:
    case RACE_CONSTANTS.OPCODE_SET_GAME_MODE: {
      return {
        type: 'gameMode',
        enabled: payload[0] === 0x01
      };
    }
    case RACE_CONSTANTS.OPCODE_GET_EQ_PRESET:
    case RACE_CONSTANTS.OPCODE_SET_EQ_PRESET: {
      return {
        type: 'eq',
        preset: payload[0]
      };
    }
    default:
      return {
        type: 'unknown',
        opcode,
        payload
      };
  }
}
