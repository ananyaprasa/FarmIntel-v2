import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { Shell } from "@/components/agri/Shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Terra·AI — Agricultural Intelligence" },
      {
        name: "description",
        content:
          "Multi-model agricultural AI: leaf disease detection, soil analysis, crop recommendation, and expert advice in English, Tamil, Hindi and Telugu.",
      },
      {
        property: "og:title",
        content: "Terra·AI — Agricultural Intelligence",
      },
      {
        property: "og:description",
        content:
          "Diagnose plant disease, analyze soil, and get crop recommendations powered by AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <Shell />
      <Toaster position="top-center" richColors />
    </>
  );
}
