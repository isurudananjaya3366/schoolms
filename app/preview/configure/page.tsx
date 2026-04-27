import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ConfigurePresenter from "./ConfigurePresenter";

export const metadata = {
  title: "Configure Slides | SchoolMS",
};

export default async function ConfigureSlidesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <ConfigurePresenter />;
}
