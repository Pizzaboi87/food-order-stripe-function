import { throwIfMissing } from "./utils.js";

async function setup() {
  throwIfMissing(process.env, [
    "APPWRITE_FUNCTION_API_KEY",
    "APPWRITE_DATABASE_ID",
    "APPWRITE_COLLECTION_ID",
  ]);

  console.log("Setup skipped (schema managed manually in Appwrite Console).");
}

setup();
