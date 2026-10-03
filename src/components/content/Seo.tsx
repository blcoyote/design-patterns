import { useEffect } from "react";
import { SITE_NAME, type SharePage } from "@/lib/seoPages";

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

export function Seo({
  page,
}: {
  page: Pick<SharePage, "title" | "description" | "sharePath">;
}) {
  useEffect(() => {
    const pageTitle = `${page.title} | ${SITE_NAME}`;
    const pageDescription = page.description.replace(/\s+/g, " ").trim();
    const excerpt =
      pageDescription.length > 160
        ? `${pageDescription.slice(0, 157).trimEnd()}...`
        : pageDescription;

    const shareMarker = window.location.pathname.indexOf("/share/");
    const basePath =
      shareMarker >= 0
        ? window.location.pathname.slice(0, shareMarker + 1)
        : window.location.pathname.endsWith("/")
          ? window.location.pathname
          : `${window.location.pathname}/`;
    const shareUrl = `${basePath}${page.sharePath.replace(/^\/+/, "")}`;
    if (window.location.pathname !== shareUrl) {
      window.history.replaceState(
        window.history.state,
        "",
        `${shareUrl}${window.location.search}${window.location.hash}`,
      );
    }

    document.title = pageTitle;
    setMeta("name", "description", excerpt);
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", excerpt);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", `${window.location.origin}${shareUrl}`);
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", excerpt);

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = `${window.location.origin}${shareUrl}`;
  }, [page.title, page.description, page.sharePath]);

  return null;
}
