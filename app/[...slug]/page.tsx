// Next.js router shim (container-owned): every other path is looked up in the hosted app's
// manifest `pages` table, so a hosted app adds or removes pages without touching /app.
import { notFound } from "next/navigation";
import manifest from "../../hosted-app/app.manifest";

export const dynamicParams = true;

export function generateStaticParams() {
  return Object.keys(manifest.pages).map((key) => ({ slug: key.split("/") }));
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const load = manifest.pages[slug.join("/")];
  if (!load) notFound();
  const { default: Component } = await load();
  return <Component />;
}
