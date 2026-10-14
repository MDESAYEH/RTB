import { provision } from "../lib/store";
// Creates or resets an admin account: ADMIN_IDENTIFIER (email or +phone), ADMIN_PASSWORD (14+ characters),
// optional ADMIN_ROLE (owner | manager | editor | scorer, default owner).
if (!process.env.ADMIN_PASSWORD)
  throw Error("Set ADMIN_PASSWORD before provisioning");
if (!process.env.ADMIN_IDENTIFIER)
  throw Error(
    "Set ADMIN_IDENTIFIER to an email address or an international phone number (+218...)",
  );
const id = await provision(process.env.ADMIN_PASSWORD, {
  identifier: process.env.ADMIN_IDENTIFIER,
  role: process.env.ADMIN_ROLE || "owner",
});
console.log(`Admin account ready: ${id} (${process.env.ADMIN_ROLE || "owner"}).`);
