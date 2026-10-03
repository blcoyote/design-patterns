import { useEffect } from "react";

const SITE_NAME = "Design Patterns";

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
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  useEffect(() => {
    const pageTitle = `${title} | ${SITE_NAME}`;
    const pageDescription = description.replace(/\s+/g, " ").trim();
    const excerpt =
      pageDescription.length > 160
        ? `${pageDescription.slice(0, 157).trimEnd()}...`
        : pageDescription;

    document.title = pageTitle;
    setMeta("name", "description", excerpt);
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", excerpt);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:card", "summary");
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", excerpt);
  }, [title, description]);

  return null;
}
