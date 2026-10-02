// Next.js router shim (container-owned). The hosted app supplies layout + metadata through
// hosted-app/app.manifest.ts - see container/app-contract.ts.
import manifest from "../hosted-app/app.manifest";

export const metadata = manifest.metadata;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <manifest.Layout>{children}</manifest.Layout>;
}
