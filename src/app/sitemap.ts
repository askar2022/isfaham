import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{
    path: string;
    changeFrequency: "monthly" | "yearly";
    priority: number;
  }> = [
    {
      path: "",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      path: "/privacy",
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      path: "/terms",
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      path: "/support",
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      path: "/contact",
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  return pages.map((page) => ({
    url: `https://isfaham.org${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
