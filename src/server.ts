import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

// The Lovable Vite preview requires a physical src/server.ts entry.
// The installed TanStack Start version does not expose createServerEntry
// as a named export in its dev runtime. Export the universal fetch
// entry shape directly, retaining the standard Start request handler.
const fetch = createStartHandler(defaultStreamHandler);

export default { fetch };
