import assert from "node:assert/strict";
import { test } from "node:test";
import { addressBucket } from "@/auth/client-ip";

test("an IPv4 address is its own bucket", () => {
  assert.equal(addressBucket("203.0.113.7"), "203.0.113.7");
});

test("a mapped IPv4 address is the IPv4 address", () => {
  assert.equal(addressBucket("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(addressBucket("::FFFF:203.0.113.7"), "203.0.113.7");
});

test("an IPv6 address is its /64, however it's written", () => {
  const bucket = "2001:db8:1:2::/64";
  assert.equal(addressBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), bucket);
  assert.equal(addressBucket("2001:DB8:1:2::1"), bucket);
  assert.equal(addressBucket("2001:0db8:0001:0002:0000:0000:0000:0001"), bucket);
  assert.equal(addressBucket("2001:db8:1:2::"), bucket);
});

test("addresses in different /64s are different buckets", () => {
  assert.notEqual(addressBucket("2001:db8:1:2::1"), addressBucket("2001:db8:1:3::1"));
});

test("`::` can fall inside the /64", () => {
  assert.equal(addressBucket("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(addressBucket("::1"), "0:0:0:0::/64");
  assert.equal(addressBucket("::"), "0:0:0:0::/64");
});

test("a zone id and an embedded IPv4 tail don't matter", () => {
  assert.equal(addressBucket("fe80::1%eth0"), "fe80:0:0:0::/64");
  assert.equal(addressBucket("64:ff9b::192.0.2.33"), "64:ff9b:0:0::/64");
});
