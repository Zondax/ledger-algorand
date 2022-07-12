"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.__esModule = true;
exports.LedgerError = void 0;
var common_1 = require("./common");
exports.LedgerError = common_1.LedgerError;
var config_1 = require("./config");
__exportStar(require("./types"), exports);
function processGetAddrResponse(response) {
    var errorCodeData = response.slice(-2);
    var returnCode = (errorCodeData[0] * 256 + errorCodeData[1]);
    var publicKey = response.slice(0, config_1.PKLEN).toString('hex');
    var address = response.slice(config_1.PKLEN, response.length - 2).toString('ascii');
    return {
        // Legacy
        bech32_address: address,
        compressed_pk: publicKey,
        //
        publicKey: publicKey,
        address: address,
        returnCode: returnCode,
        errorMessage: (0, common_1.errorCodeToString)(returnCode),
        // legacy
        return_code: returnCode,
        error_message: (0, common_1.errorCodeToString)(returnCode)
    };
}
var AlgorandApp = /** @class */ (function () {
    function AlgorandApp(transport) {
        if (!transport) {
            throw new Error("Transport has not been defined");
        }
        this.transport = transport;
    }
    AlgorandApp.prepareChunks = function (accountId, message) {
        var chunks = [];
        // First chunk prepend accountId if != 0
        var messageBuffer = Buffer.from(message);
        var buffer;
        if (accountId !== 0) {
            var accountIdBuffer = Buffer.alloc(4);
            accountIdBuffer.writeUInt32BE(accountId);
            buffer = Buffer.concat([accountIdBuffer, messageBuffer]);
        }
        else {
            buffer = Buffer.concat([messageBuffer]);
        }
        for (var i = 0; i < buffer.length; i += common_1.CHUNK_SIZE) {
            var end = i + common_1.CHUNK_SIZE;
            if (i > buffer.length) {
                end = buffer.length;
            }
            chunks.push(buffer.slice(i, end));
        }
        return chunks;
    };
    AlgorandApp.prototype.signGetChunks = function (accountId, message) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (typeof message === 'string') {
                    return [2 /*return*/, AlgorandApp.prepareChunks(accountId, Buffer.from(message))];
                }
                return [2 /*return*/, AlgorandApp.prepareChunks(accountId, message)];
            });
        });
    };
    AlgorandApp.prototype.getVersion = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, common_1.getVersion)(this.transport)["catch"](function (err) { return (0, common_1.processErrorResponse)(err); })];
            });
        });
    };
    AlgorandApp.prototype.getAppInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.transport.send(0xb0, 0x01, 0, 0).then(function (response) {
                        var errorCodeData = response.slice(-2);
                        var returnCode = errorCodeData[0] * 256 + errorCodeData[1];
                        var result = {};
                        var appName = "err";
                        var appVersion = "err";
                        var flagLen = 0;
                        var flagsValue = 0;
                        if (response[0] !== 1) {
                            // Ledger responds with format ID 1. There is no spec for any format != 1
                            result.errorMessage = "response format ID not recognized";
                            result.returnCode = common_1.LedgerError.DeviceIsBusy;
                        }
                        else {
                            var appNameLen = response[1];
                            appName = response.slice(2, 2 + appNameLen).toString("ascii");
                            var idx = 2 + appNameLen;
                            var appVersionLen = response[idx];
                            idx += 1;
                            appVersion = response.slice(idx, idx + appVersionLen).toString("ascii");
                            idx += appVersionLen;
                            var appFlagsLen = response[idx];
                            idx += 1;
                            flagLen = appFlagsLen;
                            flagsValue = response[idx];
                        }
                        return {
                            returnCode: returnCode,
                            errorMessage: (0, common_1.errorCodeToString)(returnCode),
                            // legacy
                            return_code: returnCode,
                            error_message: (0, common_1.errorCodeToString)(returnCode),
                            //
                            appName: appName,
                            appVersion: appVersion,
                            flagLen: flagLen,
                            flagsValue: flagsValue,
                            flagRecovery: (flagsValue & 1) !== 0,
                            // eslint-disable-next-line no-bitwise
                            flagSignedMcuCode: (flagsValue & 2) !== 0,
                            // eslint-disable-next-line no-bitwise
                            flagOnboarded: (flagsValue & 4) !== 0,
                            // eslint-disable-next-line no-bitwise
                            flagPINValidated: (flagsValue & 128) !== 0
                        };
                    }, common_1.processErrorResponse)];
            });
        });
    };
    AlgorandApp.prototype.deviceInfo = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.transport.send(0xe0, 0x01, 0, 0, Buffer.from([]), [0x6e00])
                        .then(function (response) {
                        var errorCodeData = response.slice(-2);
                        var returnCode = errorCodeData[0] * 256 + errorCodeData[1];
                        if (returnCode === 0x6e00) {
                            return {
                                return_code: returnCode,
                                error_message: "This command is only available in the Dashboard"
                            };
                        }
                        var targetId = response.slice(0, 4).toString("hex");
                        var pos = 4;
                        var secureElementVersionLen = response[pos];
                        pos += 1;
                        var seVersion = response.slice(pos, pos + secureElementVersionLen).toString();
                        pos += secureElementVersionLen;
                        var flagsLen = response[pos];
                        pos += 1;
                        var flag = response.slice(pos, pos + flagsLen).toString("hex");
                        pos += flagsLen;
                        var mcuVersionLen = response[pos];
                        pos += 1;
                        // Patch issue in mcu version
                        var tmp = response.slice(pos, pos + mcuVersionLen);
                        if (tmp[mcuVersionLen - 1] === 0) {
                            tmp = response.slice(pos, pos + mcuVersionLen - 1);
                        }
                        var mcuVersion = tmp.toString();
                        return {
                            returnCode: returnCode,
                            errorMessage: (0, common_1.errorCodeToString)(returnCode),
                            // legacy
                            return_code: returnCode,
                            error_message: (0, common_1.errorCodeToString)(returnCode),
                            // //
                            targetId: targetId,
                            seVersion: seVersion,
                            flag: flag,
                            mcuVersion: mcuVersion
                        };
                    }, common_1.processErrorResponse)];
            });
        });
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    AlgorandApp.prototype.getAddressAndPubKey = function (accountId, requireConfirmation) {
        if (accountId === void 0) { accountId = 0; }
        if (requireConfirmation === void 0) { requireConfirmation = false; }
        return __awaiter(this, void 0, void 0, function () {
            var data, p1_value;
            return __generator(this, function (_a) {
                data = Buffer.alloc(4);
                data.writeUInt32BE(accountId);
                p1_value = requireConfirmation ? common_1.P1_VALUES.SHOW_ADDRESS_IN_DEVICE : common_1.P1_VALUES.ONLY_RETRIEVE;
                return [2 /*return*/, this.transport
                        .send(config_1.CLA, config_1.INS.GET_PUBLIC_KEY, p1_value, common_1.P2_VALUES.DEFAULT, data, [0x9000])
                        .then(processGetAddrResponse, common_1.processErrorResponse)];
            });
        });
    };
    AlgorandApp.prototype.signSendChunk = function (chunkIdx, chunkNum, accountId, chunk) {
        return __awaiter(this, void 0, void 0, function () {
            var p1, p2;
            return __generator(this, function (_a) {
                p1 = common_1.P1_VALUES.MSGPACK_ADD;
                p2 = common_1.P2_VALUES.MSGPACK_ADD;
                if (chunkIdx === 1) {
                    p1 = (accountId !== 0) ? common_1.P1_VALUES.MSGPACK_FIRST_ACCOUNT_ID : common_1.P1_VALUES.MSGPACK_FIRST;
                }
                if (chunkIdx === chunkNum) {
                    p2 = common_1.P2_VALUES.MSGPACK_LAST;
                }
                return [2 /*return*/, this.transport
                        .send(config_1.CLA, config_1.INS.SIGN_MSGPACK, p1, p2, chunk, [
                        common_1.LedgerError.NoErrors,
                        common_1.LedgerError.DataIsInvalid,
                        common_1.LedgerError.BadKeyHandle,
                        common_1.LedgerError.SignVerifyError
                    ])
                        .then(function (response) {
                        var errorCodeData = response.slice(-2);
                        var returnCode = errorCodeData[0] * 256 + errorCodeData[1];
                        var errorMessage = (0, common_1.errorCodeToString)(returnCode);
                        if (returnCode === common_1.LedgerError.BadKeyHandle ||
                            returnCode === common_1.LedgerError.DataIsInvalid ||
                            returnCode === common_1.LedgerError.SignVerifyError) {
                            errorMessage = "".concat(errorMessage, " : ").concat(response
                                .slice(0, response.length - 2)
                                .toString("ascii"));
                        }
                        if (returnCode === common_1.LedgerError.NoErrors && response.length > 2) {
                            var signature = response.slice(0, response.length - 2);
                            return {
                                signature: signature,
                                returnCode: returnCode,
                                errorMessage: errorMessage,
                                // legacy
                                return_code: returnCode,
                                error_message: (0, common_1.errorCodeToString)(returnCode)
                            };
                        }
                        return {
                            returnCode: returnCode,
                            errorMessage: errorMessage,
                            // legacy
                            return_code: returnCode,
                            error_message: (0, common_1.errorCodeToString)(returnCode)
                        };
                    }, common_1.processErrorResponse)];
            });
        });
    };
    AlgorandApp.prototype.sign = function (accountId, message) {
        if (accountId === void 0) { accountId = 0; }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.signGetChunks(accountId, message).then(function (chunks) {
                        return _this.signSendChunk(1, chunks.length, accountId, chunks[0]).then(function (result) { return __awaiter(_this, void 0, void 0, function () {
                            var i;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        i = 1;
                                        _a.label = 1;
                                    case 1:
                                        if (!(i < chunks.length)) return [3 /*break*/, 4];
                                        return [4 /*yield*/, this.signSendChunk(1 + i, chunks.length, accountId, chunks[i])];
                                    case 2:
                                        // eslint-disable-next-line no-await-in-loop,no-param-reassign
                                        result = _a.sent();
                                        if (result.return_code !== common_1.ERROR_CODE.NoError) {
                                            return [3 /*break*/, 4];
                                        }
                                        _a.label = 3;
                                    case 3:
                                        i += 1;
                                        return [3 /*break*/, 1];
                                    case 4: return [2 /*return*/, {
                                            return_code: result.return_code,
                                            error_message: result.error_message,
                                            signature: result.signature
                                        }];
                                }
                            });
                        }); }, common_1.processErrorResponse);
                    })];
            });
        });
    };
    return AlgorandApp;
}());
exports["default"] = AlgorandApp;
