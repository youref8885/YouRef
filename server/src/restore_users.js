import "./loadEnv.js";
import { supabase } from "./supabaseClient.js";
import { hashPassword } from "./utils.js";

async function restoreUsers() {
  const usersToRestore = [
    {
      id: "usr_admin_803b4a22-0a6f-4c17-92e0-4fe5fa3ed468",
      email: "admin@admin.cl",
      password: "Admin123!"
    },
    {
      id: "usr_af2a4d32-c6a0-40b0-a193-33647d06a609",
      email: "fernando.cabezas@gmail.com",
      password: "Admin123!" // Restoring to a likely password or consistent one
    },
    {
      id: "usr_82ffe423-2a6a-43db-a58b-383cd9ea8954",
      email: "007.lloyd.higgs@gmail.com",
      password: "Admin123!"
    }
  ];

  for (const user of usersToRestore) {
    console.log(`Restoring user: ${user.email}...`);
    const { error } = await supabase
      .from("users")
      .update({
        email: user.email,
        password_hash: hashPassword(user.password),
        is_verified: true
      })
      .eq("id", user.id);

    if (error) {
      console.error(`Error restoring user ${user.email}:`, error);
    } else {
      console.log(`SUCCESS: User ${user.email} restored.`);
    }
  }
}

restoreUsers();
