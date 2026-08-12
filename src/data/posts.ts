export interface Post {
  title: string;
  date: string;
  dateValue: number;
  excerpt: string;
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
