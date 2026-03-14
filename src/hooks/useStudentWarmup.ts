import { useEffect, useRef } from "react";
import useAuth from "./useAuth";
import useProfile from "./useProfile";
import { classService } from "../services/classService";
import { materialService } from "../services/materialService";
import useMonthlyAccess from "./useMonthlyAccess";

const MAX_SUBJECTS_TO_WARM = 3;
const MAX_CHAPTERS_PER_SUBJECT_TO_WARM = 2;

export default function useStudentWarmup() {
  const { user } = useAuth();
  const { className, studentType } = useProfile();
  const { paid } = useMonthlyAccess();
  const warmKeyRef = useRef("");

  useEffect(() => {
    if (!user?.id || !className) return;

    const run = async () => {
      try {
        const warmKey = `${user.id}:${className}:${paid ? "paid" : "unpaid"}`;
        if (warmKeyRef.current === warmKey) return;
        warmKeyRef.current = warmKey;

        const subjects = await classService.getSubjects(className);
        const limitedSubjects = subjects.slice(0, MAX_SUBJECTS_TO_WARM);
        const canAccessPaid = paid;

        for (const subject of limitedSubjects) {
          const chapters = await classService.getChapters(
            className,
            subject.slug
          );
          const limitedChapters = chapters.slice(
            0,
            MAX_CHAPTERS_PER_SUBJECT_TO_WARM
          );

          for (const chapter of limitedChapters) {
            await Promise.allSettled([
              classService.getLectures(
                className,
                subject.slug,
                chapter.slug
              ),
              materialService.getMaterials({
                studentClass: className,
                subject: subject.slug,
                chapter: chapter.slug,
                canAccessPaid,
              }),
            ]);
          }
        }
      } catch {
        // Warmup must never block user flow.
      }
    };

    void run();
  }, [className, paid, studentType, user?.id]);
}
