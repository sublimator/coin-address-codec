'use strict';
const hash = require('hash.js');
const bn = require('bn.js');
const _ = require('lodash');
const assert = require('assert');
const fixtures = require('./fixtures/base58.json');
const apiFactory = require('../src');

const VER_ED25519_SEED = [1, 225, 75];
const TWENTY_ZEROES = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0];

function sha256(bytes) {
  return hash.sha256().update(bytes).digest();
}

function digitArray(str) {
  return str.split('').map(function(d) {
    return parseInt(d, 10);
  });
}

function bnFactory(bytes) {
  return new bn(bytes, 'be');
}

function hexToByteArray(hex) {
  return new Buffer(hex, 'hex').toJSON().data;
}

const options = {sha256, defaultAlphabet: 'ripple'};
const {encode, decode, codecs : {ripple, bitcoin}, Codec} = apiFactory(options);

describe('Codec', function() {

  describe('multiple versions', function() {
    it('it inteprets an array passed as `version` as ' +
          'multiple allowed versions', function() {
      const encoded = bitcoin.encodeVersioned(TWENTY_ZEROES, 0);
      const decoded = bitcoin.decodeVersioned(encoded, [0, 5]);
      assert.throws(_ => bitcoin.decodeVersioned(encoded, [1, 5]),
                    /version_invalid/);
    })
  });

  describe('encodeVersioned', function() {
    it('0', function() {
      const encoded = encode(digitArray('00000000000000000000'),
                                   {version : 0});
      assert.strictEqual(encoded, 'rrrrrrrrrrrrrrrrrrrrrhoLvTp');
    });
    it('1', function() {
      const encoded = encode(digitArray('00000000000000000001'),
                                   {version : 0});
      assert.strictEqual(encoded, 'rrrrrrrrrrrrrrrrrrrrBZbvji');
    });
  });
  describe('decodeVersioned', function() {
    it('rrrrrrrrrrrrrrrrrrrrrhoLvTp', function() {
      const decoded = decode('rrrrrrrrrrrrrrrrrrrrrhoLvTp',
                                   {version : 0});

      assert(bnFactory(decoded).cmpn(0) === 0);
    });
    it('rrrrrrrrrrrrrrrrrrrrBZbvji', function() {
      const decoded = decode('rrrrrrrrrrrrrrrrrrrrBZbvji',
                                   {version : 0});
      assert(bnFactory(decoded).cmpn(1) === 0);
    });
  });
  describe('decode-encode identity', function() {
    it('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', function() {
      const decoded = decode('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
      const encoded = encode(decoded);
      assert.strictEqual(encoded, 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
    });
  });
  describe('encode', function() {
    fixtures.ripple.forEach( test => {
      it(`encodes "${test.hex}" to "${test.string}"`, function() {
        const encoded = encode(hexToByteArray(test.hex));
        assert.strictEqual(encoded, test.string);
      });
    });
  });
  describe('Buffer encoding', function() {
    it('can encode zero address', function() {
      var buf = new Buffer(TWENTY_ZEROES);
      var encoded = encode(buf, {version: 0});
      assert.equal(encoded, 'rrrrrrrrrrrrrrrrrrrrrhoLvTp');
    });
  });
  describe('findPrefix', function() {
    it('can find the right version bytes to induce `sEd` for 16 byte payloads',
        function() {
      const version = ripple.findPrefix(16, 'sEd');

      // Fill an array of 16 bytes
      const filled = _.fill(Array(16), 0xFF);

      // For all values 0-255, set MSB to value, then encode
      for (let i = 0; i < 0xFF; i++) {
        filled[0] = i;
        const encoded = encode(filled, {version});
        // Check that sEd prefix was induced
        assert.equal('sEd', encoded.slice(0, 3));
      }

      // This should already be filled with 0xFF, but for simple assuredness
      _.fill(filled, 0xFF);
      // For all values 0-255, set LSB to value, then encode
      for (let i = 0; i < 0xFF; i++) {
        filled[filled.length - 1] = i;
        const encoded = encode(filled, {version});
        assert.equal('sEd', encoded.slice(0, 3));
      }

      // The canonical version for sed25519 prefixes
      assert(_.isEqual(version, VER_ED25519_SEED));
    });
  });
  describe('decode', function() {
    fixtures.ripple.forEach( test => {
      it(`decodes "${test.string}" to "${test.hex}"`, function() {
        const decoded = decode(test.string);
        assert.deepEqual(decoded, hexToByteArray(test.hex));
      });
    });
  });
});
