import { redirect } from "next/navigation";

export default function Page() {
  redirect("/orders?section=saved");
}
