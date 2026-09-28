import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Partial Prerendering: each page is prerendered as a static shell and only
  // the parts inside <Suspense> that read the request (the header's login
  // state, the login page's ?next=) render per request. Without it, reading
  // the session cookie in the header would make every page fully dynamic.
  cacheComponents: true,
};

export default nextConfig;
