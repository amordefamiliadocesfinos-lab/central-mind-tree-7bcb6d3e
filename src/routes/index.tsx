import { createFileRoute } from "@tanstack/react-router";
import { LegacySpaBoundary } from "../legacy/LegacySpaBoundary";

export const Route = createFileRoute("/")({
  component: LegacySpaBoundary,
});
