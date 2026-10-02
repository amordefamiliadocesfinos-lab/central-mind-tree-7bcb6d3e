import { createServerEntry } from "@tanstack/react-start/server-entry";
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";

const fetch = createStartHandler(defaultStreamHandler);

export default createServerEntry({ fetch });
