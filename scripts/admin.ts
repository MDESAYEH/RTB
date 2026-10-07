import { provision } from "../lib/store";
if (!process.env.ADMIN_PASSWORD)
  throw Error("Set ADMIN_PASSWORD before provisioning");
await provision(process.env.ADMIN_PASSWORD);
console.log("Admin provisioned.");
