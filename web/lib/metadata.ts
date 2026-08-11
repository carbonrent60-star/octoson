import type { Metadata } from "next";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string;
};

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
  image = "/opengraph-image",
}: PageMetadataOptions): Metadata {
  const fullTitle =
    title === "Octoson"
      ? "Octoson"
      : `${title} • Octoson`;

  return {
    title,
    description,

    alternates: {
      canonical: path,
    },

    openGraph: {
      type: "website",
      siteName: "Octoson",
      locale: "az_AZ",
      title: fullTitle,
      description,
      url: path,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },

    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
  };
}
