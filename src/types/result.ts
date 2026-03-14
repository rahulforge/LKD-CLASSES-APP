export type ResultRecord = {
  id: string;
  student_id?: string;
  roll_number?: string;
  student_name?: string;
  test_name?: string;
  exam?: string;
  subject?: string | null;
  total_marks?: number;
  obtained_marks?: number;
  marks?: string;
  correct?: number | null;
  wrong?: number | null;
  test_date?: string | null;
  year?: number;
  photo_url?: string | null;
  created_at: string;
};

export type StudentResult = {
  id: string;
  name: string;
  subject: string;
  total: number;
  obtained: number;
  correct: number;
  wrong: number;
  date: string;
  percentage: number;
};
