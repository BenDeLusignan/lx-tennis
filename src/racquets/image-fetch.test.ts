import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { IMAGE_MAX_BYTES } from "@/racquets/racquet-form";
import {
  fetchImageFromLink,
  isPublicAddress,
  MAX_REDIRECTS,
  parseImageLink,
  type ImageFetchDeps,
  type ImageResponse,
} from "@/racquets/image-fetch";

// The guard is tested through the two seams that touch the network
// (`resolve` and `request`), so every case runs offline. The last tests use
// the real ones, for the links that must be refused before any connection.

const PUBLIC_IP = "93.184.216.34";
const IMAGE_BYTES = Buffer.from("pretend these are image bytes");

let resolved: string[];
let requested: string[];
let hosts: Record<string, string[]>;
/** What each URL answers with; a URL not listed is a test mistake. */
let answers: Record<string, () => ImageResponse>;
let bodyChunksRead: number;

beforeEach(() => {
  resolved = [];
  requested = [];
  hosts = { "images.example.com": [PUBLIC_IP] };
  answers = {};
  bodyChunksRead = 0;
});

function response(overrides: Partial<ImageResponse> & { chunks?: Uint8Array[] } = {}): ImageResponse {
  const { chunks = [IMAGE_BYTES], ...rest } = overrides;
  return {
    status: 200,
    location: null,
    contentLength: null,
    encoded: false,
    body: (async function* () {
      for (const chunk of chunks) {
        bodyChunksRead++;
        yield chunk;
      }
    })(),
    close() {},
    ...rest,
  };
}

const redirect = (location: string | null, status = 302) => () => response({ status, location });

const deps: ImageFetchDeps = {
  async resolve(hostname) {
    resolved.push(hostname);
    const found = hosts[hostname];
    if (!found) throw new Error(`ENOTFOUND ${hostname}`);
    return found;
  },
  async request(url) {
    requested.push(url.href);
    const answer = answers[url.href];
    if (!answer) throw new Error(`no answer for ${url.href}`);
    return answer();
  },
};

/** Fetches `link` with the fake network; the link must pass the same parse the form uses. */
async function fetchLink(link: string) {
  const url = parseImageLink(link);
  assert.ok(url, `${link} should parse`);
  const originalError = console.error;
  console.error = () => {};
  try {
    return await fetchImageFromLink(url, deps);
  } finally {
    console.error = originalError;
  }
}

const FETCH_FAILED = { ok: false, error: "image-fetch" };
const IMAGE = "https://images.example.com/racquet.png";

// --- Which addresses count as public ---

test("public addresses are allowed", () => {
  for (const address of [
    "8.8.8.8",
    "1.1.1.1",
    PUBLIC_IP,
    "172.15.255.255",
    "172.32.0.0",
    "11.0.0.1",
    "100.63.255.255",
    "100.128.0.0",
    "169.253.255.255",
    "192.167.255.255",
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "2a00:1450:4001:81b::200e",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
  ]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("loopback, private, link-local, metadata and other non-public addresses are refused", () => {
  for (const address of [
    // loopback
    "127.0.0.1",
    "127.255.255.254",
    "::1",
    "0:0:0:0:0:0:0:1",
    // "this host"
    "0.0.0.0",
    "::",
    // private
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "192.168.255.255",
    "fc00::1",
    "fd12:3456:789a::1",
    // link-local, including the cloud metadata address
    "169.254.0.1",
    "169.254.169.254",
    "fe80::1",
    "fe80::a9fe:a9fe",
    // shared, documentation, benchmarking, multicast, broadcast
    "100.64.0.1",
    "100.127.255.255",
    "192.0.2.1",
    "198.51.100.1",
    "203.0.113.1",
    "198.18.0.1",
    "224.0.0.1",
    "239.255.255.255",
    "240.0.0.1",
    "255.255.255.255",
    "ff02::1",
    "2001:db8::1",
    // IPv4 inside IPv6, in every spelling
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::FFFF:10.0.0.1",
    "::ffff:169.254.169.254",
    "::ffff:a9fe:a9fe",
    "0:0:0:0:0:ffff:192.168.1.1",
    // tunnels that carry an IPv4 address
    "64:ff9b::7f00:1",
    "2002:7f00:1::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "::7f00:1",
    // not an address at all
    "localhost",
    "",
    "999.1.1.1",
    "1.2.3",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

// --- Which links are accepted ---

test("only plain https links are accepted, and odd spellings of an address are folded to dotted form", () => {
  assert.equal(parseImageLink(` ${IMAGE} `)?.href, IMAGE);
  assert.equal(parseImageLink("https://images.example.com:443/a.png")?.href, IMAGE.replace("racquet", "a"));
  for (const bad of [
    "http://images.example.com/a.png",
    "https://images.example.com:8443/a.png",
    "https://u:p@images.example.com/a.png",
    "ftp://images.example.com/a.png",
    "https://images.example.com/a\u0000.png",
    "https://images.example.com/\ta b.png",
    "",
    "   ",
  ]) {
    assert.equal(parseImageLink(bad), null, JSON.stringify(bad));
  }
  assert.equal(parseImageLink("https://2130706433/")?.hostname, "127.0.0.1");
  assert.equal(parseImageLink("https://0x7f.1/")?.hostname, "127.0.0.1");
  assert.equal(parseImageLink("https://[::ffff:127.0.0.1]/")?.hostname, "[::ffff:7f00:1]");
});

// --- The fetch ---

test("a public image is fetched, connecting to the vetted address", async () => {
  answers[IMAGE] = () => response({ contentLength: IMAGE_BYTES.length });
  const result = await fetchLink(IMAGE);
  assert.deepEqual(result, { ok: true, bytes: IMAGE_BYTES });
  assert.deepEqual(resolved, ["images.example.com"]);
  assert.deepEqual(requested, [IMAGE]);
});

test("a host that resolves to loopback, a private range or the metadata address is refused without a request", async () => {
  for (const address of ["127.0.0.1", "::1", "10.0.0.7", "192.168.1.20", "172.16.5.5", "169.254.169.254", "::ffff:10.0.0.7", "fd00::5", "0.0.0.0"]) {
    hosts["internal.example.com"] = [address];
    assert.deepEqual(await fetchLink("https://internal.example.com/a.png"), FETCH_FAILED, address);
  }
  assert.deepEqual(requested, []);
});

test("one private answer among public ones refuses the host (no rebinding mix)", async () => {
  hosts["mixed.example.com"] = [PUBLIC_IP, "10.0.0.1"];
  assert.deepEqual(await fetchLink("https://mixed.example.com/a.png"), FETCH_FAILED);
  hosts["mixed.example.com"] = ["10.0.0.1", PUBLIC_IP];
  assert.deepEqual(await fetchLink("https://mixed.example.com/a.png"), FETCH_FAILED);
  assert.deepEqual(requested, []);
});

test("a host that doesn't resolve, or resolves to nothing, is refused", async () => {
  assert.deepEqual(await fetchLink("https://nowhere.example.com/a.png"), FETCH_FAILED);
  hosts["empty.example.com"] = [];
  assert.deepEqual(await fetchLink("https://empty.example.com/a.png"), FETCH_FAILED);
  assert.deepEqual(requested, []);
});

test("IP addresses written into the link are checked directly, in every spelling, without a lookup", async () => {
  for (const link of [
    "https://127.0.0.1/a.png",
    "https://127.1/a.png",
    "https://2130706433/a.png",
    "https://0x7f000001/a.png",
    "https://0177.0.0.1/a.png",
    "https://[::1]/a.png",
    "https://[::ffff:127.0.0.1]/a.png",
    "https://[::ffff:7f00:1]/a.png",
    "https://10.1.2.3/a.png",
    "https://192.168.0.1/a.png",
    "https://169.254.169.254/latest/meta-data/",
    "https://[fd00:ec2::254]/latest/meta-data/",
    "https://[fe80::1]/a.png",
    "https://0.0.0.0/a.png",
  ]) {
    assert.deepEqual(await fetchLink(link), FETCH_FAILED, link);
  }
  assert.deepEqual(resolved, []);
  assert.deepEqual(requested, []);
});

test("a public IP address in the link is allowed and connected to as written", async () => {
  answers[`https://${PUBLIC_IP}/a.png`] = () => response();
  assert.equal((await fetchLink(`https://${PUBLIC_IP}/a.png`)).ok, true);
  assert.deepEqual(resolved, []);
});

test("a redirect to a private or loopback host is refused, and the private host is never requested", async () => {
  hosts["internal.example.com"] = ["10.0.0.1"];
  hosts["loopback.example.com"] = ["127.0.0.1"];
  for (const location of [
    "https://internal.example.com/secret",
    "https://loopback.example.com/",
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://2130706433/",
    "/\\169.254.169.254/x", // a path some clients read as a host
  ]) {
    requested.length = 0;
    answers[IMAGE] = redirect(location);
    const result = await fetchLink(IMAGE);
    assert.deepEqual(result, FETCH_FAILED, location);
    assert.ok(requested.every((href) => href === IMAGE), `${location}: only the first hop was requested (${requested})`);
  }
});

test("a redirect off https, to a credentialed or odd-port address, or with no Location is refused", async () => {
  for (const location of [
    "http://images.example.com/a.png",
    "ftp://images.example.com/a.png",
    "https://u:p@images.example.com/a.png",
    "https://images.example.com:8443/a.png",
    "data:image/png;base64,AAAA",
    null,
    "",
  ]) {
    answers[IMAGE] = redirect(location);
    assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED, String(location));
  }
  assert.ok(requested.every((href) => href === IMAGE));
});

test("redirects are followed up to the limit, relative Locations included, each hop re-checked", async () => {
  hosts["cdn.example.com"] = ["151.101.1.1"];
  answers[IMAGE] = redirect("/moved/racquet.png", 301);
  answers["https://images.example.com/moved/racquet.png"] = redirect("https://cdn.example.com/final.png", 307);
  answers["https://cdn.example.com/final.png"] = () => response();
  assert.deepEqual(await fetchLink(IMAGE), { ok: true, bytes: IMAGE_BYTES });
  assert.deepEqual(resolved, ["images.example.com", "images.example.com", "cdn.example.com"]);

  // MAX_REDIRECTS redirects are followed; one more is refused.
  for (let hop = 0; hop <= MAX_REDIRECTS + 1; hop++) {
    answers[`https://images.example.com/hop${hop}`] = redirect(`/hop${hop + 1}`);
  }
  answers[`https://images.example.com/hop${MAX_REDIRECTS}`] = () => response();
  assert.equal((await fetchLink("https://images.example.com/hop0")).ok, true);
  assert.deepEqual(await fetchLink("https://images.example.com/hop1"), { ok: true, bytes: IMAGE_BYTES });
  answers[`https://images.example.com/hop${MAX_REDIRECTS}`] = redirect(`/hop${MAX_REDIRECTS + 1}`);
  assert.deepEqual(await fetchLink("https://images.example.com/hop0"), FETCH_FAILED);
  // A loop ends at the limit too.
  answers[IMAGE] = redirect(IMAGE);
  requested.length = 0;
  assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED);
  assert.equal(requested.length, MAX_REDIRECTS + 1);
});

test("a body over the size limit is refused: by Content-Length without reading it, or as it streams, stopping early", async () => {
  answers[IMAGE] = () => response({ contentLength: IMAGE_MAX_BYTES + 1 });
  assert.deepEqual(await fetchLink(IMAGE), { ok: false, error: "image-size" });
  assert.equal(bodyChunksRead, 0, "nothing was read");

  // No (or a lying) Content-Length: stop as soon as the running total passes the limit.
  const chunk = new Uint8Array(1_000_000);
  answers[IMAGE] = () => response({ chunks: Array.from({ length: 50 }, () => chunk) });
  assert.deepEqual(await fetchLink(IMAGE), { ok: false, error: "image-size" });
  assert.equal(bodyChunksRead, 5, "stopped after the chunk that crossed 4,000,000 bytes");

  answers[IMAGE] = () => response({ contentLength: 10, chunks: Array.from({ length: 50 }, () => chunk) });
  assert.deepEqual(await fetchLink(IMAGE), { ok: false, error: "image-size" });

  // Exactly the limit is fine.
  answers[IMAGE] = () => response({ chunks: [new Uint8Array(IMAGE_MAX_BYTES)] });
  const exact = await fetchLink(IMAGE);
  assert.equal(exact.ok && exact.bytes.length, IMAGE_MAX_BYTES);
});

test("an error status, an encoded body, a dropped connection or a failed request is image-fetch", async () => {
  for (const status of [204, 301 /* no Location */, 400, 401, 403, 404, 410, 429, 500, 503]) {
    answers[IMAGE] = () => response({ status });
    assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED, String(status));
  }
  answers[IMAGE] = () => response({ encoded: true });
  assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED);
  answers[IMAGE] = () =>
    response({
      body: (async function* () {
        yield new Uint8Array(10);
        throw new Error("socket hang up");
      })(),
    });
  assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED);
  delete answers[IMAGE]; // the fake request throws
  assert.deepEqual(await fetchLink(IMAGE), FETCH_FAILED);
});

test("a failed fetch logs only the error's name and code, never the host or address from the link", async () => {
  const lookupFailure = Object.assign(new Error("getaddrinfo ENOTFOUND images.example.com"), { code: "ENOTFOUND" });
  const url = parseImageLink(IMAGE);
  assert.ok(url);
  const logged: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => void logged.push(args);
  try {
    const result = await fetchImageFromLink(url, { ...deps, resolve: async () => Promise.reject(lookupFailure) });
    assert.deepEqual(result, FETCH_FAILED);
  } finally {
    console.error = originalError;
  }
  assert.equal(logged.length, 1);
  const text = logged[0].join(" ");
  assert.match(text, /Error ENOTFOUND/);
  assert.doesNotMatch(text, /example\.com/);
});

test("the response is always closed, including after a refusal", async () => {
  let closed = 0;
  const closing = (overrides: Partial<ImageResponse>) => () => response({ ...overrides, close: () => void closed++ });
  answers[IMAGE] = closing({});
  await fetchLink(IMAGE);
  answers[IMAGE] = closing({ contentLength: IMAGE_MAX_BYTES + 1 });
  await fetchLink(IMAGE);
  answers[IMAGE] = closing({ status: 302, location: "http://images.example.com/" });
  await fetchLink(IMAGE);
  answers[IMAGE] = closing({ status: 500 });
  await fetchLink(IMAGE);
  assert.equal(closed, 4);
});

// --- The real resolver and request, for links that never get as far as a connection ---

test("with the real resolver: localhost, loopback and private literals are refused, no connection made", async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    for (const link of [
      "https://localhost/a.png",
      "https://127.0.0.1/a.png",
      "https://[::1]/a.png",
      "https://10.0.0.1/a.png",
      "https://192.168.1.1/a.png",
      "https://169.254.169.254/latest/meta-data/",
      "https://2130706433/a.png",
    ]) {
      const url = parseImageLink(link);
      assert.ok(url, link);
      assert.deepEqual(await fetchImageFromLink(url), FETCH_FAILED, link);
    }
  } finally {
    console.error = originalError;
  }
});
