import { Ad } from "./types";
import { getAllAds } from "./adsRepo";

export async function fetchAllAds(): Promise<Ad[]> {
  return getAllAds();
}
