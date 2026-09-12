export interface Post {
  title: string;
  date: string;
  dateValue: number;
  excerpt: string;
  /** Handwritten one-liner for homepage section rows (overrides excerpt there). */
  summary?: string;
  /** Type-of-work tag(s), comma-separated. */
  discipline?: string;
  html?: string;
  slug?: string;
  /** Hosted mini-app path. Name click goes here instead of the post. */
  app?: string;
  /** External site. Name click leaves the site; the post is not a destination. */
  link?: string;
  /** Body is long enough to deserve a "read more" next to the app name. */
  writeup?: boolean;
  tags: string[];
  category?: string;
  feature_image?: string;
  /** Every image in the post (feature + body), for the gallery view. */
  images?: string[];
  img?: string;
  roles?: string;
  tools?: string;
  agency?: string;
}
