import ProductionPortal from "./production-portal";
import { getChatGPTUser } from "./chatgpt-auth";
import { cookies } from "next/headers";
import { PORTAL_SESSION_COOKIE, verifyPortalSession } from "./credential-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  const cookieStore = await cookies();
  const credential = await verifyPortalSession(cookieStore.get(PORTAL_SESSION_COOKIE)?.value).catch(() => null);
  const initialUser = credential
    ? { name: credential.displayName, email: credential.username, credential: true, role: credential.role, accessLevel: credential.accessLevel }
    : user ? { name: user.displayName, email: user.email, role: "production" as const, accessLevel: "admin" as const } : null;
  return <ProductionPortal initialUser={initialUser} />;
}
