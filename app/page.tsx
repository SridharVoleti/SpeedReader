// Next.js router shim (container-owned): "/" renders the hosted app's Home.
import manifest from "../hosted-app/app.manifest";

export default function Page() {
  return <manifest.Home />;
}
