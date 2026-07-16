export type MediaType = "radio" | "tv";

export interface Station {
  id: number;
  name: string;
  mediaType: MediaType;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  language: string;
  scope: string;
  description: string;
  websiteUrl: string;
  streamUrl: string;
  streamFormat: string;
  status: "verified" | "catalogued" | "demo";
  verifiedAt: string;
  externalId: string;
  countryCode: string;
  geoPrecision: "exact" | "city" | "region" | "country";
  faviconUrl: string;
  tags: string;
}

export interface CatalogStats {
  total: number;
  radio: number;
  tv: number;
  countries: number;
  playable: number;
  mappable: number;
}
