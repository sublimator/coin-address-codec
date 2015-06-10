'use strict';

const baseCodec = require('base-x');

function seqEqual(arr1, arr2) {
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

// Concatenates args and/or contents of sequence conforming args to an Array.
function toArray() {
  let args = arguments;
  if (args.length === 1 && Array.isArray(args[0])) {
    return args[0];
  }
  let ret = [];
  for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (arg.length !== undefined) {
      for (let j = 0; j < arg.length; j++) {
        ret.push(arg[j]);
      }
    } else {
      ret.push(arg);
    }
  }
  return ret;
}

function isSet(o) {
  return o !== null && o !== undefined;
}

/* --------------------------------- ENCODER -------------------------------- */


function codecFactory(injected) {

/*eslint-disable indent*/
const sha256 = injected.sha256;

class AddressCodec {
  /*eslint-enable indent*/

  constructor(alphabet) {
    this.alphabet = alphabet;
    this.codec = baseCodec(alphabet);
    this.base = alphabet.length;
  }

  encodeRaw(bytes) {
    return this.codec.encode(bytes);
  }

  decodeRaw(string) {
    return this.codec.decode(string);
  }

  verifyCheckSum(bytes) {
    const computed = sha256(sha256(bytes.slice(0, -4))).slice(0, 4);
    const checksum = bytes.slice(-4);
    return seqEqual(computed, checksum);
  };

  encodeVersioned(bytes, version) {
    return this.encodeChecked(toArray(version, bytes));
  }

  encodeChecked(buffer) {
    const check = sha256(sha256(buffer)).slice(0, 4);
    return this.encodeRaw(toArray(buffer, check));
  }

  encode(bytes, opts={}) {
    const {version} = opts;
    return isSet(version) ? this.encodeVersioned(bytes, version) :
                            this.encodeRaw(bytes);
  }

  decode(string, opts={}) {
    const {version, versions, expectedLength} = opts;
    return isSet(versions) ?
                this.decodeMultiVersioned(string, versions, expectedLength) :
           isSet(version) ?
                this.decodeVersioned(string, version) :
                this.decodeRaw(string);
  }

  decodeChecked(encoded) {
    const buf = this.decodeRaw(encoded);
    if (buf.length < 5) {
      throw new Error('invalid_input_size');
    }
    if (!this.verifyCheckSum(buf)) {
      throw new Error('checksum_invalid');
    }
    return buf.slice(0, -4);
  }

  decodeVersioned(string, version) {
    const versions = Array.isArray(version) ? version : [version];
    return this.decodeMultiVersioned(string, versions).bytes;
  }

  /**
  * @param {Number} payloadLength - number of bytes encoded not incl checksum
  * @param {String} desiredPrefix - desired prefix when base58 encoded with
  *                                 checksum
  * @return {Array} version
  */
  findPrefix(payloadLength, desiredPrefix) {
    if (this.base !== 58) {
      throw new Error('Only works for base58');
    }
    const totalLength = payloadLength + 4; // for checksum
    const chars = (Math.log(Math.pow(256, totalLength)) / Math.log(this.base));
     // (x, x.8] -> x+1, (x.8, x+1) -> x+2
    const requiredChars = Math.ceil(chars + 0.2);
    const padding = this.alphabet[Math.floor((this.alphabet.length) / 2) - 1];
    const template = desiredPrefix + new Array(requiredChars + 1).join(padding);
    const bytes = this.decodeRaw(template);
    const version = bytes.slice(0, -totalLength);
    return version;
  }

  /**
  *
  * @param {String} encoded - base58 checksum encoded data string
  * @param {Array} possibleVersions - array of possible versions.
  *                                   Each element could be a single byte or an
  *                                   array of bytes.
  * @param {Number} expectedLength - of decoded bytes minus checksum
  *
  * @return {Object} -
  */
  decodeMultiVersioned(encoded, possibleVersions, expectedLength) {
    const withoutSum = this.decodeChecked(encoded);
    const ret = {version: null, bytes: null};

    const payloadLength = expectedLength || withoutSum.length - 1;
    const versionBytes = withoutSum.slice(0, -payloadLength);
    const payload = withoutSum.slice(-payloadLength);

    possibleVersions.forEach(function(version) {
      const asArray = Array.isArray(version) ? version : [version];
      if (seqEqual(versionBytes, asArray)) {
        ret.version = version;
        ret.bytes = payload;
        return false;
      }
    });

    if (!ret.bytes) {
      throw new Error('version_invalid');
    }
    return ret;
  };

}

/*eslint-disable indent*/
return AddressCodec;
/*eslint-enable indent*/
}
/* ------------------------------- END ENCODER ------------------------------ */

module.exports = codecFactory;
