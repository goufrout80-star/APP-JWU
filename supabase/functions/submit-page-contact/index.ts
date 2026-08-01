import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

type PageSlug = "todayfilmmakers" | "thephotoshopguide";
type PageConfig = {
  slug: PageSlug;
  site: string;
  name: string;
  prefix: string;
  origins: Set<string>;
};

const PAGE_CONFIGS: Record<PageSlug, PageConfig> = {
  todayfilmmakers: {
    slug: "todayfilmmakers",
    site: "todayfilmmakers",
    name: "Today Film Makers",
    prefix: "TFM",
    origins: new Set([
      "https://todayfilmmakers.com",
      "https://www.todayfilmmakers.com",
      "https://todayfilmmakers.vercel.app",
      "https://todayfilmmakers-mmmmorad123-gmailcoms-projects.vercel.app",
      "https://todayfilmmakers-git-main-mmmmorad123-gmailcoms-projects.vercel.app",
    ]),
  },
  thephotoshopguide: {
    slug: "thephotoshopguide",
    site: "thephotoshopguide",
    name: "The Photoshop Guide",
    prefix: "TPG",
    origins: new Set([
      "https://thephotoshopguide.com",
      "https://www.thephotoshopguide.com",
      "https://thephotoshopguideweb.vercel.app",
      "https://thephotoshopguideweb-mmmmorad123-gmailcoms-projects.vercel.app",
      "https://thephotoshopguideweb-git-main-mmmmorad123-gmailcoms-projects.vercel.app",
    ]),
  },
};

const ALL_ORIGINS = new Set(
  Object.values(PAGE_CONFIGS).flatMap((config) => [...config.origins]),
);
const encoder = new TextEncoder();

function isLocal(origin: string | null) {
  return Boolean(origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
}

function isKnownOrigin(origin: string | null) {
  return Boolean(origin && (ALL_ORIGINS.has(origin) || isLocal(origin)));
}

function cors(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (isKnownOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin!;
  return headers;
}

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanText(value: unknown, max: number, required = false, min = 0): string | null {
  if (typeof value !== "string") {
    if (required) throw new Error("missing_field");
    return null;
  }
  const clean = value.trim().replace(/\u0000/g, "");
  if (required && clean.length < Math.max(1, min)) throw new Error("missing_field");
  if (clean.length > max) throw new Error("field_too_long");
  return clean || null;
}

function cleanEmail(value: unknown): string {
  const email = cleanText(value, 254, true, 5)!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("invalid_email");
  return email;
}

function cleanUrl(value: unknown): string | null {
  const raw = cleanText(value, 500);
  if (!raw) return null;
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(normalized);
  if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname.includes('.')) {
    throw new Error("invalid_url");
  }
  parsed.hash = "";
  return parsed.toString();
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`${SERVICE_ROLE_KEY}:${value}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function reference(config: PageConfig, id: string, createdAt: string) {
  return `${config.prefix}-${new Date(createdAt).getUTCFullYear()}-${id.slice(0, 6).toUpperCase()}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}

async function sendOptionalEmails(params: {
  config: PageConfig;
  notifyEmail: string | null;
  reference: string;
  name: string;
  company: string;
  website: string | null;
  email: string;
  message: string;
}) {
  if (!RESEND_API_KEY) return;

  const from = params.config.slug === "todayfilmmakers"
    ? (Deno.env.get("TFM_EMAIL_FROM") || Deno.env.get("PAGE_EMAIL_FROM") || "")
    : (Deno.env.get("TPG_EMAIL_FROM") || "");
  if (!from) return;

  const safeName = escapeHtml(params.name);
  const safeCompany = escapeHtml(params.company);
  const safeWebsite = escapeHtml(params.website || "Not provided");
  const safeEmail = escapeHtml(params.email);
  const safeMessage = escapeHtml(params.message).replace(/\n/g, "<br>");
  const requests: Promise<Response>[] = [];

  if (params.notifyEmail) {
    requests.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.notifyEmail],
        reply_to: params.email,
        subject: `[${params.reference}] New ${params.config.name} contact from ${params.company}`,
        html: `<h2>New ${params.config.name} contact</h2><p><strong>Reference:</strong> ${params.reference}</p><p><strong>Full name:</strong> ${safeName}</p><p><strong>Company:</strong> ${safeCompany}</p><p><strong>Website:</strong> ${safeWebsite}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Message:</strong><br>${safeMessage}</p>`,
      }),
    }));
  }

  requests.push(fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.email],
      reply_to: params.notifyEmail || undefined,
      subject: `${params.reference} · ${params.config.name} received your message`,
      html: `<h2>Message received</h2><p>Hi ${safeName},</p><p>${params.config.name} received your message. Your reference is <strong>${params.reference}</strong>.</p><p>Our team will review it and reply by email, usually within 1–2 business days.</p>`,
    }),
  }));

  const results = await Promise.allSettled(requests);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("Email delivery failed", result.reason);
    else if (!result.value.ok) console.error("Email provider rejected request", result.value.status);
  });
}

function pageConfig(value: unknown): PageConfig | null {
  if (typeof value !== "string") return null;
  return PAGE_CONFIGS[value as PageSlug] || null;
}

function originAllowedForPage(config: PageConfig, origin: string | null) {
  return !origin || config.origins.has(origin) || isLocal(origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return isKnownOrigin(origin)
      ? new Response(null, { status: 204, headers: cors(origin) })
      : json(403, { ok: false, error: "Origin not allowed." }, origin);
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed." }, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(503, { ok: false, error: "The secure contact service is unavailable." }, origin);
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > 30000) return json(413, { ok: false, error: "The message is too large." }, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid request." }, origin);
  }

  const config = pageConfig(body.page);
  if (!config || !originAllowedForPage(config, origin)) {
    return json(403, { ok: false, error: "Origin not allowed." }, origin);
  }
  if (body.company_website || body.fax_number) {
    return json(201, { ok: true, reference: `${config.prefix}-RECEIVED` }, origin);
  }
  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return json(400, { ok: false, error: "Invalid contact message." }, origin);
  }

  const payload = body.payload as Record<string, unknown>;
  let name: string;
  let company: string;
  let website: string | null;
  let email: string;
  let message: string;

  try {
    name = cleanText(payload.name, 120, true, 2)!;
    company = cleanText(payload.company, 180, true, 2)!;
    website = cleanUrl(payload.website);
    email = cleanEmail(payload.email);
    message = cleanText(payload.message ?? payload.brief, 5000, true, 10)!;
  } catch {
    return json(400, {
      ok: false,
      error: "Please check your name, company, website, email and message, then try again.",
    }, origin);
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = req.headers.get("cf-connecting-ip") || forwarded || "unknown";
  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ipHash = await hash(ip);
  const emailHash = await hash(email);

  for (const [key, seconds, maximum] of [
    [`${config.slug}:minute:${ipHash}`, 60, 4],
    [`${config.slug}:day:${ipHash}`, 86400, 20],
    [`${config.slug}:email:${emailHash}`, 86400, 5],
  ] as const) {
    const { data, error } = await client.rpc("consume_submission_rate_limit", {
      p_rate_key: key,
      p_window_seconds: seconds,
      p_max_requests: maximum,
    });
    if (error) return json(503, { ok: false, error: "The secure contact service is temporarily unavailable." }, origin);
    if (data !== true) return json(429, { ok: false, error: "Too many messages were submitted. Please wait and try again later." }, origin);
  }

  const { data: page, error: pageError } = await client
    .from("managed_pages")
    .select("id, notification_email")
    .eq("slug", config.slug)
    .eq("active", true)
    .single();
  if (pageError || !page) return json(503, { ok: false, error: "The contact service is temporarily unavailable." }, origin);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: duplicate } = await client
    .from("page_contacts")
    .select("id, created_at")
    .eq("page_id", page.id)
    .eq("email", email)
    .gte("created_at", tenMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (duplicate) {
    return json(200, {
      ok: true,
      reference: reference(config, duplicate.id, duplicate.created_at),
      duplicate: true,
    }, origin);
  }

  const clientMeta = payload.meta && typeof payload.meta === "object" && !Array.isArray(payload.meta)
    ? payload.meta as Record<string, unknown>
    : {};
  const details = {
    source: `${config.slug}-contact`,
    sourceVersion: 4,
    visibleFields: ["name", "company", "website", "email", "message"],
    browserLanguage: cleanText(clientMeta.browserLanguage, 40),
    viewport: cleanText(clientMeta.viewport, 40),
    referencePrefix: config.prefix,
  };
  const meta = {
    referrer: cleanText(clientMeta.referrer, 500) || "Direct",
    landingPath: cleanText(clientMeta.landingPath, 300) || "/",
    submitPath: cleanText(clientMeta.submitPath, 300) || "/",
    timezone: cleanText(clientMeta.timezone, 100),
    userAgent: cleanText(req.headers.get("user-agent"), 500),
    countryCode: cleanText(req.headers.get("cf-ipcountry"), 4),
  };

  const { data: inserted, error: insertError } = await client
    .from("page_contacts")
    .insert({
      page_id: page.id,
      site: config.site,
      name,
      company,
      email,
      website,
      message,
      status: "new",
      meta,
      details,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("Page contact insert failed", insertError?.message);
    return json(500, { ok: false, error: "We could not save your message. Please try again." }, origin);
  }

  const ref = reference(config, inserted.id, inserted.created_at);
  await sendOptionalEmails({
    config,
    notifyEmail: page.notification_email,
    reference: ref,
    name,
    company,
    website,
    email,
    message,
  });

  return json(201, { ok: true, reference: ref }, origin);
});
