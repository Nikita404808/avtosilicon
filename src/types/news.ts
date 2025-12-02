export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  content: string;
  date: string;
  image?: string | null;
}
