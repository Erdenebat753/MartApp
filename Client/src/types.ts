export type Item = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  price?: number | null;
  heading_deg?: number | null;
};

export type SlamStart = {
  id: number;
  x: number;
  y: number;
  z?: number | null;
  heading_deg?: number | null;
};
