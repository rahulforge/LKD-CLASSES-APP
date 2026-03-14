export type StudentCategory = "school" | "competitive";
export type StudentMode = "online" | "offline";
export type StudentFilter = "all" | StudentMode;

export type TeacherStudent = {
  id: string;
  user_id?: string | null;
  name: string;
  roll_number: string | null;
  phone: string | null;
  class_id: string | null;
  class_name: string | null;
  category: StudentCategory;
  student_type: StudentMode;
  admission_paid: boolean;
  app_access_paid?: boolean;
  joined_at?: string | null;
};

export type TeacherClassHierarchy = {
  id: string;
  name: string;
  subjects: {
    id: string;
    name: string;
    chapters: {
      id: string;
      name: string;
    }[];
  }[];
};

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type TeacherDashboardSummary = {
  totalStudents: number;
  onlineStudents: number;
  offlineStudents: number;
  recentUploads: {
    lectures: number;
    materials: number;
  };
  recentNotices: {
    id: string;
    title: string;
    message: string;
    created_at: string;
  }[];
};

export type TeacherNotice = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  created_by: string | null;
};

export type TeacherLectureInput = {
  title: string;
  class_id: string;
  subject_id: string;
  chapter_id: string;
  video_url: string;
  video_type: "youtube_video" | "youtube_playlist" | "cloudinary_video";
  playlist_id?: string | null;
  is_free?: boolean;
};

export type TeacherMaterialInput = {
  title: string;
  class_id: string;
  subject_id: string;
  chapter_id: string;
  file_url: string;
  is_preview?: boolean;
};

export type TeacherOfferInput = {
  title: string;
  description: string;
  price: number;
  valid_till: string;
  promo_code?: string | null;
  registration_link: string;
};

export type TeacherResultInput = {
  student_name: string;
  exam: string;
  marks: string;
  year: number;
  photo_url: string;
};

export type TeacherTopperInput = {
  name: string;
  class: string;
  marks: string;
  image_url: string;
  rank: number;
  obtained_marks?: number | null;
  total_marks?: number | null;
};

export type GalleryUploadInput = {
  album_id: string;
  image_url: string;
  caption?: string;
};
