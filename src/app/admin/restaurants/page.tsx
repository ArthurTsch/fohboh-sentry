import { redirect } from "next/navigation";

export default function AdminRestaurantsRedirectPage() {
  redirect("/superadmin/restaurants");
}
