import { redirect } from "next/navigation";

export default function PatientMessagesRedirect(): never {
  redirect("/patient/chat");
}
