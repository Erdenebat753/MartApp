export type Item = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  price?: number | null;
  heading_deg?: number | null;
  image_url?: string | null;
  sale_percent?: number | null;
  description?: string | null;
  note?: string | null;
  sale_end_at?: string | null;
};

export type SlamStart = {
  id: number;
  x: number;
  y: number;
  z?: number | null;
  heading_deg?: number | null;
};
