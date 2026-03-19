import "./loadEnv.js";
import { supabase } from "./supabaseClient.js";
import fs from 'fs';

async function checkUsers() {
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, role, is_verified");

  if (error) {
    console.error("Error fetching users:", error);
  } else {
    fs.writeFileSync('users_debug.json', JSON.stringify(users, null, 2));
    console.log("DONE");
  }
}

checkUsers();
