import { useCallback, useEffect, useState } from "react";
import { classService } from "../services/classService";

export function useTeacherClasses() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await classService.getTeacherClasses();
    setClasses(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    classes,
    loading,
    refresh: load,
  };
}

export function useTeacherSubjects(classId: string) {
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!classId) {
      setSubjects([]);
      setLoading(false);
      return;
    }

    const data = await classService.getTeacherSubjects(classId);
    setSubjects(data);
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { subjects, loading, refresh: load };
}

export function useTeacherChapters(subjectId: string) {
  const [chapters, setChapters] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!subjectId) {
      setChapters([]);
      setLoading(false);
      return;
    }

    const data = await classService.getTeacherChapters(subjectId);
    setChapters(data);
    setLoading(false);
  }, [subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { chapters, loading, refresh: load };
}

export function useTeacherChapterUploads(input: {
  classId: string;
  subjectId: string;
  chapterId: string;
  limit?: number;
}) {
  const [lectures, setLectures] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { classId, subjectId, chapterId, limit } = input;

  const load = useCallback(async () => {
    if (!classId || !subjectId || !chapterId) {
      setLectures([]);
      setMaterials([]);
      setLoading(false);
      return;
    }

    const data = await classService.getTeacherChapterUploads({
      classId,
      subjectId,
      chapterId,
      limit,
    });
    setLectures(data.lectures);
    setMaterials(data.materials);
    setLoading(false);
  }, [chapterId, classId, limit, subjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    lectures,
    materials,
    loading,
    refresh: load,
  };
}
