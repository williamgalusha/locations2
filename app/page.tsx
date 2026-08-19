import ProductionPortal from "./production-portal";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <ProductionPortal initialUser={user ? { name: user.displayName, email: user.email } : null} />;
}
