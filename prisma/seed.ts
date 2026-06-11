/**
 * Migration script: Base44 FaxDirect → Postgres
 *
 * Run after setting up the new database:
 *   npx tsx prisma/seed.ts
 *
 * This imports your existing saved contacts and historical fax data
 * from the Base44 app via its API. Requires a Base44 API token.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Base44 API config — set these before running
const BASE44_APP_ID = "6980c27f905d89d644876af6";
const BASE44_API_URL = "https://base44.app/api";
// You'll need a Base44 API token — get it from the Base44 dashboard
const BASE44_TOKEN = process.env.BASE44_TOKEN || "";

async function fetchBase44(entity: string, limit = 500) {
  const res = await fetch(
    `${BASE44_API_URL}/apps/${BASE44_APP_ID}/entities/${entity}?limit=${limit}`,
    {
      headers: { Authorization: `Bearer ${BASE44_TOKEN}` },
    }
  );
  if (!res.ok) {
    console.error(`Failed to fetch ${entity}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.entities || data || [];
}

// Email → Role mapping for admin users
const ADMIN_EMAILS = ["emoore@epicems.com", "nregister@epicems.com", "mschroeder@epicems.com"];

async function migrateUsers() {
  console.log("Migrating users...");
  const users = await fetchBase44("User");

  for (const u of users) {
    if (!u.email) continue;
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.full_name || u.email.split("@")[0] },
      create: {
        email: u.email,
        name: u.full_name || u.email.split("@")[0],
        role: ADMIN_EMAILS.includes(u.email) ? "ADMIN" : "USER",
      },
    });
    console.log(`  ✓ ${u.email}`);
  }
}

async function migrateSavedNumbers() {
  console.log("Migrating saved fax numbers...");
  const numbers = await fetchBase44("SavedFaxNumber");

  for (const n of numbers) {
    // Find the creator user
    const creatorEmail = n.created_by || "emoore@epicems.com";
    let user = await prisma.user.findUnique({ where: { email: creatorEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: creatorEmail, name: creatorEmail.split("@")[0] },
      });
    }

    const phone = n.phone_number?.replace(/\s/g, "").replace(/[^\d+]/g, "");
    if (!phone) continue;

    const normalized = phone.startsWith("+") ? phone :
      phone.length === 10 ? `+1${phone}` :
      phone.length === 11 && phone.startsWith("1") ? `+${phone}` : `+${phone}`;

    try {
      await prisma.savedFaxNumber.upsert({
        where: {
          phoneNumber_createdById: { phoneNumber: normalized, createdById: user.id },
        },
        update: { name: n.name, useCount: n.use_count || 0 },
        create: {
          name: n.name,
          phoneNumber: normalized,
          useCount: n.use_count || 0,
          createdById: user.id,
        },
      });
      console.log(`  ✓ ${n.name} (${normalized}) — ${n.use_count || 0} uses`);
    } catch (e: any) {
      console.error(`  ✗ ${n.name}: ${e.message}`);
    }
  }
}

async function migrateSentFaxes() {
  console.log("Migrating sent faxes...");
  const faxes = await fetchBase44("SentFax");

  for (const f of faxes) {
    const senderEmail = f.created_by || "emoore@epicems.com";
    let user = await prisma.user.findUnique({ where: { email: senderEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: senderEmail, name: senderEmail.split("@")[0] },
      });
    }

    try {
      await prisma.sentFax.create({
        data: {
          toNumber: f.to || "",
          fromNumber: f.from || "+18882789949",
          faxSid: f.fax_sid || `legacy_${f.id}`,
          status: f.status || "unknown",
          fileName: f.file_name || null,
          fileUrl: f.file_url || null,
          sentAt: f.sent_at ? new Date(f.sent_at) : new Date(f.created_date),
          completedAt: f.completed_at ? new Date(f.completed_at) : null,
          duration: f.duration ? Math.round(f.duration) : null,
          numPages: f.num_pages ? Math.round(f.num_pages) : null,
          errorMessage: f.error_message || null,
          retryCount: f.retry_count || 0,
          lastRetryAt: f.last_retry_at ? new Date(f.last_retry_at) : null,
          sentById: user.id,
        },
      });
      console.log(`  ✓ ${f.to} — ${f.status}`);
    } catch (e: any) {
      if (e.code === "P2002") {
        console.log(`  ⊘ Skipping duplicate: ${f.fax_sid}`);
      } else {
        console.error(`  ✗ ${f.to}: ${e.message}`);
      }
    }
  }
}

async function migrateReceivedFaxes() {
  console.log("Migrating received faxes...");
  const faxes = await fetchBase44("ReceivedFax");

  for (const f of faxes) {
    try {
      await prisma.receivedFax.create({
        data: {
          fromNumber: f.from || "unknown",
          toNumber: f.to || "+18882789949",
          faxSid: f.fax_sid || `legacy_${f.id}`,
          status: f.status || "received",
          numPages: f.num_pages ? Math.round(f.num_pages) : null,
          mediaUrl: f.media_url || null,
          receivedAt: f.received_at ? new Date(f.received_at) : new Date(f.created_date),
        },
      });
      console.log(`  ✓ From ${f.from} — ${f.num_pages || "?"} pages`);
    } catch (e: any) {
      if (e.code === "P2002") {
        console.log(`  ⊘ Skipping duplicate: ${f.fax_sid}`);
      } else {
        console.error(`  ✗ ${f.from}: ${e.message}`);
      }
    }
  }
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  FaxDirect Migration: Base44 → Postgres");
  console.log("═══════════════════════════════════════\n");

  if (!BASE44_TOKEN) {
    console.log("⚠  No BASE44_TOKEN set. Running in manual mode.");
    console.log("   Set BASE44_TOKEN env var to auto-import from Base44 API.\n");
    console.log("   For now, you can manually insert data or use the app.\n");
    return;
  }

  await migrateUsers();
  console.log();
  await migrateSavedNumbers();
  console.log();
  await migrateSentFaxes();
  console.log();
  await migrateReceivedFaxes();
  console.log("\n✅ Migration complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
