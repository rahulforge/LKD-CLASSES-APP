import { supabase } from "../../lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CACHE_TTL_MS } from "../utils/constants";

const GALLERY_ALBUMS_CACHE = "gallery_albums_v1";
const galleryImagesCacheKey = (albumId: string) =>
  `gallery_images_v1_${albumId}`;

export type GalleryAlbum = {
  id: string;
  title: string;
  cover_url: string | null;
  created_at: string;
};

export type GalleryImage = {
  id: string;
  album_id: string;
  image_url: string;
  created_at: string;
};

export const galleryService = {
  async getAlbums(): Promise<GalleryAlbum[]> {
    const cached = await AsyncStorage.getItem(GALLERY_ALBUMS_CACHE);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          time: number;
          data: GalleryAlbum[];
        };
        if (Date.now() - parsed.time < CACHE_TTL_MS) {
          void this.refreshAlbums();
          return parsed.data;
        }
      } catch {
        // ignore cache parse error
      }
    }

    return this.refreshAlbums();
  },

  async refreshAlbums(): Promise<GalleryAlbum[]> {
    const { data, error } = await supabase
      .from("gallery_albums")
      .select("id, title, cover_url, created_at")
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    const albums = data as GalleryAlbum[];
    await AsyncStorage.setItem(
      GALLERY_ALBUMS_CACHE,
      JSON.stringify({ time: Date.now(), data: albums })
    );
    return albums;
  },

  async getAlbumImages(albumId: string): Promise<GalleryImage[]> {
    const cacheKey = galleryImagesCacheKey(albumId);
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          time: number;
          data: GalleryImage[];
        };
        if (Date.now() - parsed.time < CACHE_TTL_MS) {
          void this.refreshAlbumImages(albumId);
          return parsed.data;
        }
      } catch {
        // ignore cache parse error
      }
    }
    return this.refreshAlbumImages(albumId);
  },

  async refreshAlbumImages(albumId: string): Promise<GalleryImage[]> {
    const { data, error } = await supabase
      .from("gallery_images")
      .select("id, album_id, image_url, created_at")
      .eq("album_id", albumId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    const images = data as GalleryImage[];
    await AsyncStorage.setItem(
      galleryImagesCacheKey(albumId),
      JSON.stringify({ time: Date.now(), data: images })
    );
    return images;
  },

  async saveAlbumImage(input: {
    album_id: string;
    image_url: string;
  }): Promise<void> {
    const { error } = await supabase.from("gallery_images").insert(input);

    if (error) {
      throw new Error(error.message || "Unable to save gallery image");
    }

    await Promise.all([
      AsyncStorage.removeItem(galleryImagesCacheKey(input.album_id)),
      this.refreshAlbums(),
    ]);
  },

  async createAlbum(input: {
    title: string;
    cover_url?: string | null;
  }): Promise<GalleryAlbum> {
    const { data, error } = await supabase
      .from("gallery_albums")
      .insert({
        title: input.title,
        cover_url: input.cover_url ?? null,
      })
      .select("id, title, cover_url, created_at")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Unable to create album");
    }

    await this.refreshAlbums();
    return data as GalleryAlbum;
  },
};
