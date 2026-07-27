/**
 * Seeds ~30 users and ~80 projects with real uploaded images, varied
 * upvotes/dates, and threaded comments — so the ranked feed, leaderboard,
 * and profile pages have something meaningful to render.
 *
 * Requires packages/db/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * (see .env.example). The service role key is never fetched or generated
 * by this script or any tool — get it yourself from Supabase Dashboard >
 * Project Settings > API, and never paste it into chat.
 *
 * Safe to re-run: every seeded user's email lives under
 * SEED_EMAIL_DOMAIN; a prior run's users (and their storage objects) are
 * deleted before new ones are created, so `pnpm seed` never doubles data.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import { imageSize } from "image-size";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "../database.types";
import { PROJECT_IDEAS } from "./project-ideas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy packages/db/.env.example to packages/db/.env and fill in the\n" +
      "service role key from Supabase Dashboard > Project Settings > API.\n" +
      "Never paste that key into chat.",
  );
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NUM_USERS = 30;
const NUM_PROJECTS = 80;
const SEED_EMAIL_DOMAIN = "seed.cobuild.dev";
const SEED_PASSWORD = "cobuild-seed-" + faker.string.alphanumeric(24);

const ROLE_POOL = ["developer", "designer", "founder"] as const;
const TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];
const COLLEGES = [
  "Northeastern University",
  "UC Berkeley",
  "Georgia Tech",
  "University of Waterloo",
  "IIT Bombay",
  "Carnegie Mellon University",
  "University of Toronto",
];
const CATEGORY_TAGS = ["hackathon", "side-project", "class-project", "open-source"];
const REPLY_PHRASES = [
  "How did you handle {topic} under the hood?",
  "This is really clean — what's the stack for {topic}?",
  "Ran into the same problem building something similar. Did you consider caching this?",
  "The {topic} part is the hardest bit to get right, nice work.",
  "Following — building something adjacent to this right now.",
  "What was the biggest gotcha while building this?",
  "Would love a writeup on the {topic} decision.",
  "Clean UI. Is this open source?",
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// --- Sample images -----------------------------------------------------

const UPLOADS_DIR = path.resolve(
  __dirname,
  "../../../../CoBuild design system/uploads",
);

function loadSampleImages() {
  const files = readdirSync(UPLOADS_DIR).filter((f) => f.endsWith(".webp"));
  if (files.length === 0) {
    throw new Error(`No .webp sample images found in ${UPLOADS_DIR}`);
  }
  return files.map((filename) => {
    const buffer = readFileSync(path.join(UPLOADS_DIR, filename));
    const { width, height } = imageSize(buffer);
    return { filename, buffer, width, height };
  });
}

function pickImage(images: ReturnType<typeof loadSampleImages>) {
  return images[Math.floor(Math.random() * images.length)];
}

async function uploadImage(
  bucket: "avatars" | "project-media",
  storagePath: string,
  image: ReturnType<typeof loadSampleImages>[number],
) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(storagePath, image.buffer, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed (${storagePath}): ${error.message}`);
  return storagePath;
}

// --- Cleanup (makes the script safely re-runnable) ----------------------

async function deleteAllUnderPrefix(bucket: "avatars" | "project-media", prefix: string) {
  const { data: entries, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !entries) return;
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      // Folder — recurse one level (matches our {user}/{project}/{file} layout).
      await deleteAllUnderPrefix(bucket, entryPath);
    } else {
      files.push(entryPath);
    }
  }
  if (files.length > 0) {
    await admin.storage.from(bucket).remove(files);
  }
}

async function resetPreviousSeedRun() {
  console.log("Clearing any previous seed run...");
  let page = 1;
  const seedUserIds: string[] = [];
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const seeded = data.users.filter((u) => u.email?.endsWith(`@${SEED_EMAIL_DOMAIN}`));
    seedUserIds.push(...seeded.map((u) => u.id));
    if (data.users.length < 200) break;
    page++;
  }

  for (const id of seedUserIds) {
    await deleteAllUnderPrefix("avatars", id);
    await deleteAllUnderPrefix("project-media", id);
    await admin.auth.admin.deleteUser(id);
  }
  console.log(`  removed ${seedUserIds.length} users from a previous run`);
}

// --- Tags ----------------------------------------------------------------

async function seedTags() {
  const techSlugs = new Set(PROJECT_IDEAS.flatMap((p) => p.tags));
  const techRows = [...techSlugs].map((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((w) => (w === "css" ? "CSS" : w[0].toUpperCase() + w.slice(1)))
      .join(" "),
    kind: "tech",
  }));
  const categoryRows = CATEGORY_TAGS.map((slug) => ({
    slug,
    name: slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
    kind: "category",
  }));

  const { data, error } = await admin
    .from("tags")
    .upsert([...techRows, ...categoryRows], { onConflict: "slug" })
    .select("id, slug");
  if (error) throw error;

  return new Map(data.map((t) => [t.slug, t.id]));
}

// --- Users -----------------------------------------------------------------

async function seedUsers(images: ReturnType<typeof loadSampleImages>) {
  const usedUsernames = new Set<string>();
  const profiles: { id: string; username: string; roles: string[] }[] = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let username = slugify(`${firstName}${lastName}${faker.number.int({ min: 1, max: 999 })}`);
    while (usedUsernames.has(username)) {
      username = `${username}${faker.number.int({ min: 1, max: 9999 })}`;
    }
    usedUsernames.add(username);

    const email = `${username}@${SEED_EMAIL_DOMAIN}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(`createUser failed for ${email}: ${createErr?.message}`);
    }
    const userId = created.user.id;

    const isStudent = Math.random() < 0.3;
    const roles: string[] = faker.helpers.arrayElements(ROLE_POOL, { min: 1, max: 2 });
    if (isStudent) roles.push("student");

    const avatarPath = await uploadImage("avatars", `${userId}/avatar.webp`, pickImage(images));

    const links: Record<string, string> = {};
    if (Math.random() < 0.7) links.github = `https://github.com/${username}`;
    if (Math.random() < 0.3) links.website = `https://${username}.dev`;
    if (roles.includes("designer") && Math.random() < 0.5) {
      links.dribbble = `https://dribbble.com/${username}`;
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        username,
        display_name: `${firstName} ${lastName}`,
        avatar_url: avatarPath, // storage path, not a resolvable URL — see database.types.ts
        bio: faker.lorem.sentence({ min: 8, max: 18 }),
        headline: faker.helpers.arrayElement([
          "Full-stack developer",
          "Frontend engineer & sometimes-designer",
          "CS student, building on weekends",
          "Product designer who codes",
          "Backend-leaning generalist",
        ]),
        github_username: username,
        roles,
        is_student: isStudent,
        college: isStudent ? faker.helpers.arrayElement(COLLEGES) : null,
        grad_year: isStudent ? faker.number.int({ min: 2026, max: 2029 }) : null,
        location: `${faker.location.city()}, ${faker.location.countryCode()}`,
        timezone: faker.helpers.arrayElement(TIMEZONES),
        links,
      })
      .eq("id", userId);
    if (updateErr) throw updateErr;

    profiles.push({ id: userId, username, roles });
    process.stdout.write(`\r  users: ${i + 1}/${NUM_USERS}`);
  }
  console.log();
  return profiles;
}

// --- Follows ---------------------------------------------------------------

async function seedFollows(profiles: { id: string }[]) {
  const rows: { follower_id: string; following_id: string }[] = [];
  for (const follower of profiles) {
    const followCount = faker.number.int({ min: 0, max: 10 });
    const targets = faker.helpers
      .arrayElements(
        profiles.filter((p) => p.id !== follower.id),
        followCount,
      );
    for (const target of targets) {
      rows.push({ follower_id: follower.id, following_id: target.id });
    }
  }
  if (rows.length > 0) {
    const { error } = await admin.from("follows").insert(rows);
    if (error) throw error;
  }
  console.log(`  follows: ${rows.length}`);
}

// --- Projects, images, tags, votes, comments --------------------------------

function weightedStatus(): "shipped" | "in_progress" | "archived" {
  const r = Math.random();
  if (r < 0.55) return "shipped";
  if (r < 0.9) return "in_progress";
  return "archived";
}

function weightedVisibility(): "public" | "unlisted" | "draft" {
  const r = Math.random();
  if (r < 0.9) return "public";
  if (r < 0.97) return "unlisted";
  return "draft";
}

// Seed vote rows only — never hand-set `comments.upvote_count` directly.
// The counter trigger computes it from these rows; a client-supplied value
// would be silently discarded for anon/authenticated roles but ADDED on
// top if written via the service role, so don't set both.
async function voteOnComment(
  commentId: string,
  authorId: string,
  profiles: { id: string }[],
) {
  const voters = faker.helpers.arrayElements(
    profiles.filter((p) => p.id !== authorId),
    faker.number.int({ min: 0, max: Math.min(8, profiles.length - 1) }),
  );
  if (voters.length === 0) return;
  const { error } = await admin
    .from("comment_votes")
    .insert(voters.map((v: { id: string }) => ({ comment_id: commentId, profile_id: v.id })));
  if (error) throw error;
}

async function seedProjects(
  profiles: { id: string; username: string }[],
  tagIdBySlug: Map<string, string>,
  images: ReturnType<typeof loadSampleImages>,
) {
  const usedSlugsByAuthor = new Map<string, Set<string>>();
  let created = 0;

  for (let i = 0; i < NUM_PROJECTS; i++) {
    const idea = PROJECT_IDEAS[i % PROJECT_IDEAS.length];
    const author = faker.helpers.arrayElement(profiles);

    const authorSlugs = usedSlugsByAuthor.get(author.id) ?? new Set<string>();
    let slug = slugify(idea.title);
    while (authorSlugs.has(slug)) {
      slug = `${slugify(idea.title)}-${faker.number.int({ min: 2, max: 99 })}`;
    }
    authorSlugs.add(slug);
    usedSlugsByAuthor.set(author.id, authorSlugs);

    const status = weightedStatus();
    const visibility = weightedVisibility();
    const publishedAt =
      visibility === "draft"
        ? null
        : faker.date.recent({ days: 120 }).toISOString();

    const { data: project, error: projectErr } = await admin
      .from("projects")
      .insert({
        author_id: author.id,
        slug,
        title: idea.title,
        tagline: idea.tagline,
        description: idea.description,
        status,
        visibility,
        published_at: publishedAt,
        live_url: status !== "in_progress" && Math.random() < 0.7
          ? `https://${slug}.vercel.app`
          : null,
        repo_url: `https://github.com/${author.username}/${slug}`,
      })
      .select("id")
      .single();
    if (projectErr || !project) throw new Error(`project insert failed: ${projectErr?.message}`);

    // Images
    const numImages = faker.number.int({ min: 1, max: 4 });
    const imageRows = [];
    for (let n = 0; n < numImages; n++) {
      const img = pickImage(images);
      const storagePath = await uploadImage(
        "project-media",
        `${author.id}/${project.id}/${n}-${img.filename}`,
        img,
      );
      imageRows.push({
        project_id: project.id,
        storage_path: storagePath,
        width: img.width,
        height: img.height,
        position: n,
        alt: `${idea.title} screenshot ${n + 1}`,
      });
    }
    const { error: imgErr } = await admin.from("project_images").insert(imageRows);
    if (imgErr) throw imgErr;

    await admin
      .from("projects")
      .update({ cover_image_path: imageRows[0].storage_path })
      .eq("id", project.id);

    // Tags
    const tagSlugs = [...idea.tags];
    if (idea.category) tagSlugs.push(idea.category);
    const tagRows = tagSlugs
      .map((s) => tagIdBySlug.get(s))
      .filter((id): id is string => Boolean(id))
      .map((tagId) => ({ project_id: project.id, tag_id: tagId }));
    if (tagRows.length > 0) {
      const { error: tagErr } = await admin.from("project_tags").insert(tagRows);
      if (tagErr) throw tagErr;
    }

    // Votes (skip drafts — nobody but the author could see one to vote on it)
    if (visibility !== "draft") {
      const voters = faker.helpers.arrayElements(
        profiles.filter((p) => p.id !== author.id),
        faker.number.int({ min: 0, max: Math.min(25, profiles.length - 1) }),
      );
      if (voters.length > 0) {
        const { error: voteErr } = await admin
          .from("votes")
          .insert(voters.map((v: { id: string }) => ({ project_id: project.id, profile_id: v.id })));
        if (voteErr) throw voteErr;
      }

      // Comments — top-level + up to 2 levels of replies
      const numComments = faker.number.int({ min: 0, max: 8 });
      for (let c = 0; c < numComments; c++) {
        const commenter = faker.helpers.arrayElement(profiles);
        const topic = faker.helpers.arrayElement(idea.tags);
        const { data: topLevel, error: cErr } = await admin
          .from("comments")
          .insert({
            project_id: project.id,
            author_id: commenter.id,
            body: faker.helpers
              .arrayElement(REPLY_PHRASES)
              .replace("{topic}", topic)
              .replace(/^./, (ch: string) => ch.toUpperCase()),
            depth: 0,
          })
          .select("id")
          .single();
        if (cErr || !topLevel) throw new Error(`comment insert failed: ${cErr?.message}`);
        await voteOnComment(topLevel.id, commenter.id, profiles);

        if (Math.random() < 0.4) {
          const replier = faker.helpers.arrayElement(profiles);
          const { data: reply, error: rErr } = await admin
            .from("comments")
            .insert({
              project_id: project.id,
              author_id: replier.id,
              parent_id: topLevel.id,
              depth: 1,
              body: faker.lorem.sentence({ min: 6, max: 16 }),
            })
            .select("id")
            .single();
          if (rErr || !reply) throw new Error(`reply insert failed: ${rErr?.message}`);
          await voteOnComment(reply.id, replier.id, profiles);
        }
      }
    }

    created++;
    process.stdout.write(`\r  projects: ${created}/${NUM_PROJECTS}`);
  }
  console.log();
}

// --- Main ------------------------------------------------------------------

async function main() {
  const images = loadSampleImages();
  console.log(`Loaded ${images.length} sample images from ${UPLOADS_DIR}`);

  await resetPreviousSeedRun();

  console.log("Seeding tags...");
  const tagIdBySlug = await seedTags();
  console.log(`  tags: ${tagIdBySlug.size}`);

  console.log("Seeding users...");
  const profiles = await seedUsers(images);

  console.log("Seeding follows...");
  await seedFollows(profiles);

  console.log("Seeding projects, images, tags, votes, comments...");
  await seedProjects(profiles, tagIdBySlug, images);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
