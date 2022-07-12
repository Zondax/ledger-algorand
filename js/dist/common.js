"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
exports.__esModule = true;
exports.serializePath = exports.getVersion = exports.processErrorResponse = exports.errorCodeToString = exports.ERROR_DESCRIPTION = exports.LedgerError = exports.ERROR_CODE = exports.SIGN_VALUES_P2 = exports.P2_VALUES = exports.P1_VALUES = exports.PAYLOAD_TYPE = exports.CHUNK_SIZE = void 0;
var config_1 = require("./config");
exports.CHUNK_SIZE = 250;
exports.PAYLOAD_TYPE = {
    INIT: 0x00,
    ADD: 0x01,
    LAST: 0x02
};
exports.P1_VALUES = {
    ONLY_RETRIEVE: 0x00,
    SHOW_ADDRESS_IN_DEVICE: 0x01,
    MSGPACK_FIRST: 0x00,
    MSGPACK_FIRST_ACCOUNT_ID: 0x01,
    MSGPACK_ADD: 0x80
};
exports.P2_VALUES = {
    DEFAULT: 0x00,
    MSGPACK_ADD: 0x80,
    MSGPACK_LAST: 0x00
};
// noinspection JSUnusedGlobalSymbols
exports.SIGN_VALUES_P2 = {
    DEFAULT: 0x00
};
exports.ERROR_CODE = {
    NoError: 0x9000
};
var LedgerError;
(function (LedgerError) {
    LedgerError[LedgerError["U2FUnknown"] = 1] = "U2FUnknown";
    LedgerError[LedgerError["U2FBadRequest"] = 2] = "U2FBadRequest";
    LedgerError[LedgerError["U2FConfigurationUnsupported"] = 3] = "U2FConfigurationUnsupported";
    LedgerError[LedgerError["U2FDeviceIneligible"] = 4] = "U2FDeviceIneligible";
    LedgerError[LedgerError["U2FTimeout"] = 5] = "U2FTimeout";
    LedgerError[LedgerError["Timeout"] = 14] = "Timeout";
    LedgerError[LedgerError["NoErrors"] = 36864] = "NoErrors";
    LedgerError[LedgerError["DeviceIsBusy"] = 36865] = "DeviceIsBusy";
    LedgerError[LedgerError["ErrorDerivingKeys"] = 26626] = "ErrorDerivingKeys";
    LedgerError[LedgerError["ExecutionError"] = 25600] = "ExecutionError";
    LedgerError[LedgerError["WrongLength"] = 26368] = "WrongLength";
    LedgerError[LedgerError["EmptyBuffer"] = 27010] = "EmptyBuffer";
    LedgerError[LedgerError["OutputBufferTooSmall"] = 27011] = "OutputBufferTooSmall";
    LedgerError[LedgerError["DataIsInvalid"] = 27012] = "DataIsInvalid";
    LedgerError[LedgerError["ConditionsNotSatisfied"] = 27013] = "ConditionsNotSatisfied";
    LedgerError[LedgerError["TransactionRejected"] = 27014] = "TransactionRejected";
    LedgerError[LedgerError["BadKeyHandle"] = 27264] = "BadKeyHandle";
    LedgerError[LedgerError["InvalidP1P2"] = 27392] = "InvalidP1P2";
    LedgerError[LedgerError["InstructionNotSupported"] = 27904] = "InstructionNotSupported";
    LedgerError[LedgerError["AppDoesNotSeemToBeOpen"] = 28160] = "AppDoesNotSeemToBeOpen";
    LedgerError[LedgerError["UnknownError"] = 28416] = "UnknownError";
    LedgerError[LedgerError["SignVerifyError"] = 28417] = "SignVerifyError";
})(LedgerError = exports.LedgerError || (exports.LedgerError = {}));
exports.ERROR_DESCRIPTION = (_a = {},
    _a[LedgerError.U2FUnknown] = 'U2F: Unknown',
    _a[LedgerError.U2FBadRequest] = 'U2F: Bad request',
    _a[LedgerError.U2FConfigurationUnsupported] = 'U2F: Configuration unsupported',
    _a[LedgerError.U2FDeviceIneligible] = 'U2F: Device Ineligible',
    _a[LedgerError.U2FTimeout] = 'U2F: Timeout',
    _a[LedgerError.Timeout] = 'Timeout',
    _a[LedgerError.NoErrors] = 'No errors',
    _a[LedgerError.DeviceIsBusy] = 'Device is busy',
    _a[LedgerError.ErrorDerivingKeys] = 'Error deriving keys',
    _a[LedgerError.ExecutionError] = 'Execution Error',
    _a[LedgerError.WrongLength] = 'Wrong Length',
    _a[LedgerError.EmptyBuffer] = 'Empty Buffer',
    _a[LedgerError.OutputBufferTooSmall] = 'Output buffer too small',
    _a[LedgerError.DataIsInvalid] = 'Data is invalid',
    _a[LedgerError.ConditionsNotSatisfied] = 'Conditions not satisfied',
    _a[LedgerError.TransactionRejected] = 'Transaction rejected',
    _a[LedgerError.BadKeyHandle] = 'Bad key handle',
    _a[LedgerError.InvalidP1P2] = 'Invalid P1/P2',
    _a[LedgerError.InstructionNotSupported] = 'Instruction not supported',
    _a[LedgerError.AppDoesNotSeemToBeOpen] = 'App does not seem to be open',
    _a[LedgerError.UnknownError] = 'Unknown error',
    _a[LedgerError.SignVerifyError] = 'Sign/verify error',
    _a);
function errorCodeToString(statusCode) {
    if (statusCode in exports.ERROR_DESCRIPTION)
        return exports.ERROR_DESCRIPTION[statusCode];
    return "Unknown Status Code: ".concat(statusCode);
}
exports.errorCodeToString = errorCodeToString;
function isDict(v) {
    return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
}
function processErrorResponse(response) {
    if (response) {
        if (isDict(response)) {
            if (Object.prototype.hasOwnProperty.call(response, 'statusCode')) {
                return {
                    returnCode: response.statusCode,
                    errorMessage: errorCodeToString(response.statusCode),
                    // legacy
                    return_code: response.statusCode,
                    error_message: errorCodeToString(response.statusCode)
                };
            }
            if (Object.prototype.hasOwnProperty.call(response, 'returnCode') &&
                Object.prototype.hasOwnProperty.call(response, 'errorMessage')) {
                return response;
            }
        }
        return {
            returnCode: 0xffff,
            errorMessage: response.toString(),
            // legacy
            return_code: 0xffff,
            error_message: response.toString()
        };
    }
    return {
        returnCode: 0xffff,
        errorMessage: response.toString()
    };
}
exports.processErrorResponse = processErrorResponse;
function getVersion(transport) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, transport.send(config_1.CLA, config_1.INS.GET_VERSION, 0, 0).then(function (response) {
                    var errorCodeData = response.slice(-2);
                    var returnCode = (errorCodeData[0] * 256 + errorCodeData[1]);
                    var targetId = 0;
                    if (response.length >= 9) {
                        /* eslint-disable no-bitwise */
                        targetId =
                            (response[5] << 24) + (response[6] << 16) + (response[7] << 8) + (response[8] << 0);
                        /* eslint-enable no-bitwise */
                    }
                    return {
                        returnCode: returnCode,
                        errorMessage: errorCodeToString(returnCode),
                        //
                        // legacy
                        return_code: returnCode,
                        error_message: errorCodeToString(returnCode),
                        //
                        testMode: response[0] !== 0,
                        test_mode: response[0] !== 0,
                        major: response[1],
                        minor: response[2],
                        patch: response[3],
                        deviceLocked: response[4] === 1,
                        targetId: targetId.toString(16)
                    };
                }, processErrorResponse)];
        });
    });
}
exports.getVersion = getVersion;
var HARDENED = 0x80000000;
function serializePath(path) {
    if (!path) {
        throw new Error("Invalid path.");
    }
    var numericPath = [];
    var buf = Buffer.alloc(20);
    switch (typeof path) {
        case 'string': {
            if (!path.startsWith('m')) {
                throw new Error('Path should start with "m" (e.g "m/44\'/1\'/5\'/0/3")');
            }
            var pathArray = path.split('/');
            if (pathArray.length !== 6) {
                throw new Error("Invalid path. . It should be a BIP44 path (e.g \"m/44'/1'/5'/0/3\")");
            }
            for (var i = 1; i < pathArray.length; i += 1) {
                var value = 0;
                var hardening = 0;
                if (pathArray[i].endsWith("'")) {
                    hardening = HARDENED;
                    value = Number(pathArray[i].slice(0, -1));
                }
                else {
                    value = Number(pathArray[i]);
                }
                if (value >= HARDENED) {
                    throw new Error('Incorrect child value (bigger or equal to 0x80000000)');
                }
                value += hardening;
                if (Number.isNaN(value)) {
                    throw new Error("Invalid path : ".concat(value, " is not a number. (e.g \"m/44'/1'/5'/0/3\")"));
                }
                numericPath.push(value);
                buf.writeUInt32LE(value, 4 * (i - 1));
            }
            break;
        }
        case 'object': {
            if (path.length != 5) {
                throw new Error("Invalid path. It should be a BIP44 path (e.g \"m/44'/1'/5'/0/3\")");
            }
            // Check values
            for (var i = 0; i < path.length; i += 1) {
                if (typeof path[i] != "number") {
                    throw new Error("Invalid path : ".concat(path[i], " is not a number."));
                }
                var tmp = Number(path[i]);
                if (Number.isNaN(tmp)) {
                    throw new Error("Invalid path : ".concat(tmp, " is not a number. (e.g \"m/44'/1'/5'/0/3\")"));
                }
                // automatic hardening only happens for 0, 1, 2
                if (i <= 2 && tmp >= HARDENED) {
                    throw new Error("Incorrect child ".concat(i, " value (bigger or equal to 0x80000000)"));
                }
            }
            buf.writeUInt32LE(0x80000000 + path[0], 0);
            buf.writeUInt32LE(0x80000000 + path[1], 4);
            buf.writeUInt32LE(0x80000000 + path[2], 8);
            buf.writeUInt32LE(path[3], 12);
            buf.writeUInt32LE(path[4], 16);
            break;
        }
        default:
            console.log(typeof path);
            return null;
    }
    return buf;
}
exports.serializePath = serializePath;
