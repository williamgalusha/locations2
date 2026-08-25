import ProductionPortal from "./production-portal";
import { cookies } from "next/headers";
import { PORTAL_SESSION_COOKIE, verifyPortalSession } from "./credential-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const credential = await verifyPortalSession(cookieStore.get(PORTAL_SESSION_COOKIE)?.value).catch(() => null);
  const initialUser = credential
    ? { name: credential.displayName, email: credential.username, credential: true, role: credential.role, accessLevel: credential.accessLevel }
    : null;
  return <ProductionPortal initialUser={initialUser} />;
}
