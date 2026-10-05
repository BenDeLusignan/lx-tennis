import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Partial Prerendering: each page is prerendered as a static shell and only
  // the parts inside <Suspense> that read the request (the header's login
  // state, the login page's ?next=) render per request. Without it, reading
  // the session cookie in the header would make every page fully dynamic.
  cacheComponents: true,
  images: {
    // Racquets a reviewer adds keep their photo in Vercel Blob (public store).
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  experimental: {
    serverActions: {
      // The add-a-racquet form uploads a photo through a Server Action
      // (default limit 1 MB). The photo's own cap is IMAGE_MAX_BYTES (4 MB, in
      // src/racquets/racquet-form.ts) because Vercel refuses request bodies
      // over 4.5 MB; this sits just above it (4.2 MiB ≈ 4.4 MB, plus the
      // multipart overhead), so our own "too large" message shows first.
      bodySizeLimit: "4.2mb",
    },
  },
};

export default nextConfig;
