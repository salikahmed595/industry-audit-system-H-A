// Sign-in throttling key for a client address: one bucket per IPv4 address and per IPv6 /64 (one customer network).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ipBucket } = require('../../server/security.js');

describe('ipBucket', () => {
  it('keeps an IPv4 address as it is', () => {
    assert.equal(ipBucket('203.0.113.7'), '203.0.113.7');
  });
  it('maps an IPv4-mapped IPv6 address to the IPv4 address', () => {
    assert.equal(ipBucket('::ffff:203.0.113.7'), '203.0.113.7');
    assert.equal(ipBucket('::FFFF:203.0.113.7'), '203.0.113.7');
  });
  it('reduces any IPv6 address to its /64, however it is written', () => {
    const want = '2001:db8:1:2::/64';
    for (const ip of ['2001:db8:1:2::1', '2001:0db8:0001:0002:ffff:eeee:dddd:cccc', '2001:DB8:1:2:0:0:0:9', '2001:db8:1:2::abcd:1']) assert.equal(ipBucket(ip), want, ip);
    assert.notEqual(ipBucket('2001:db8:1:3::1'), want);
  });
  it('handles compressed prefixes, a zone id and an embedded IPv4 tail', () => {
    assert.equal(ipBucket('::1'), '0:0:0:0::/64');
    assert.equal(ipBucket('fe80::1%eth0'), 'fe80:0:0:0::/64');
    assert.equal(ipBucket('64:ff9b::192.0.2.33'), '64:ff9b:0:0::/64');
    assert.equal(ipBucket('2001:db8::'), '2001:db8:0:0::/64');
  });
  it('passes anything that is not an IP address through, bounded', () => {
    assert.equal(ipBucket('unknown'), 'unknown');
    assert.equal(ipBucket('x'.repeat(500)).length, 64);
    assert.equal(ipBucket(undefined), 'unknown');
  });
});
