import { redirect } from "next/navigation";

export default function ProviderMessagesRedirect(): never {
  redirect("/provider/chat");
}
