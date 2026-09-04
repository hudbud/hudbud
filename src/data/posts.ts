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
