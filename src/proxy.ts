import { NextRequest, NextResponse } from "next/server";
import { APP_CONFIGS, APP_KEYS, type AppKey } from "@/lib/app-config";

const pageRewrites: Record<string, string> = {
  "": "/login",
  login: "/login",
  signup: "/signup",
  "forgot-password": "/forgot-password",
  setup: "/setup",
  dashboard: "/admin/dashboard",
  "class-codes": "/admin/class-codes",
  schools: "/admin/schools",
  teachers: "/admin/teachers",
  students: "/admin/students",
  settings: "/admin/settings",
};

const previewBotPattern =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot/i;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPreviewHtml(appKey: AppKey, pathname: string) {
  const config = APP_CONFIGS[appKey];
  const description =
    appKey === "elementarylearning"
      ? "Admin portal for managing Classroom K-5 teachers and students"
      : "Admin portal for managing Early Learning teachers and students";
  const url = `${config.adminBaseUrl}${pathname}`;
  const imageUrl = `${config.adminBaseUrl}${config.logoPath}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(config.portalName)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(config.portalName)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:site_name" content="${escapeHtml(config.portalName)}" />
    <meta property="og:image" content="${escapeHtml(imageUrl)}" />
    <meta property="og:image:width" content="1024" />
    <meta property="og:image:height" content="1024" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(config.portalName)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
    <link rel="icon" href="${escapeHtml(config.logoPath)}" />
    <link rel="apple-touch-icon" href="${escapeHtml(config.logoPath)}" />
  </head>
  <body></body>
</html>`;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const rawAppSegment = segments[0] || "";
  const appKey = rawAppSegment.toLowerCase() === "k-5"
    ? "elementarylearning"
    : rawAppSegment;

  if (!APP_KEYS.includes(appKey as (typeof APP_KEYS)[number])) {
    return NextResponse.next();
  }

  if (
    rawAppSegment === "elementarylearning" ||
    rawAppSegment === "K-5"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/k-5/${segments.slice(1).join("/")}`.replace(/\/$/, "");
    return NextResponse.redirect(url, 308);
  }

  if (previewBotPattern.test(request.headers.get("user-agent") || "")) {
    return new NextResponse(getPreviewHtml(appKey as AppKey, pathname), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  const routeKey = segments[1] || "";
  const rewritePath = pageRewrites[routeKey];

  if (!rewritePath) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = rewritePath;
  url.search = search;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/earlylearning/:path*",
    "/elementarylearning/:path*",
    "/k-5/:path*",
    "/K-5/:path*",
  ],
};
