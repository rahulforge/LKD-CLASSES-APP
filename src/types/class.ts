export type Subject = {
  id: string;
  name: string;
  slug: string;
  order_index: number | null;
  chapter_count?: number;
};

export type Chapter = {
  id: string;
  name: string;
  slug: string;
  order_index: number | null;
};

export type LectureProvider = "youtube" | "cloudinary";

export type Lecture = {
  id: string;
  title: string;
  duration: string | null;
  is_free: boolean;
  video_provider: LectureProvider;
  video_id: string | null;
  secure_embed_url: string | null;
  video_url?: string | null;
  video_type?: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  chapter_id?: string | null;
  created_at: string;
};
