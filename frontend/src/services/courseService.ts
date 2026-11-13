/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CourseService for CampuScope
 * Manages courses, learning units (weeks), and learning materials with strict
 * format validation (.pdf, .docx, .pptx) and upload progress simulation.
 */

import { Course, LearningUnit, Material } from '../types';
import { StorageService } from './storage';
import { SEED_COURSES } from '../data/seedData';
import { FILE_UPLOAD_LIMITS, THEME_COLORS } from '../config/constants';

export class CourseService {
  private static init(): void {
    if (!localStorage.getItem(StorageService.keys.COURSES)) {
      StorageService.set(StorageService.keys.COURSES, SEED_COURSES);
    }
  }

  static getCourses(): Course[] {
    this.init();
    return StorageService.get<Course[]>(StorageService.keys.COURSES, SEED_COURSES);
  }

  static getCourseById(id: string): Course | undefined {
    this.init();
    const courses = this.getCourses();
    return courses.find((c) => c.id === id);
  }

  static getCoursesForUser(userId: string, role: string, assignedCourseIds: string[] = []): Course[] {
    const courses = this.getCourses();
    if (role === 'admin') {
      return courses;
    }
    if (role === 'lecturer' || role === 'ta') {
      return courses.filter((c) => c.lecturerId === userId || assignedCourseIds.includes(c.id));
    }
    // student
    return courses.filter((c) => c.enrolledStudentIds.includes(userId) || assignedCourseIds.includes(c.id));
  }

  static createCourse(params: {
    title: string;
    code: string;
    description: string;
    department: string;
    semester: string;
    lecturerId: string;
    lecturerName: string;
    accentColor?: string;
  }): Course {
    this.init();
    const courses = this.getCourses();
    const newCourse: Course = {
      id: `course-${Date.now()}`,
      code: params.code,
      title: params.title,
      description: params.description,
      lecturerId: params.lecturerId,
      lecturerName: params.lecturerName,
      accentColor: params.accentColor || THEME_COLORS.PRIMARY,
      coverImage: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      fallbackGradient: 'linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)',
      semester: params.semester || 'סמסטר א׳ תשפ״ו',
      department: params.department || 'מדעי המחשב',
      enrolledStudentIds: ['user-student-1', 'user-student-2', 'user-student-3', 'user-student-4', 'user-student-5'],
      units: [],
      createdAt: new Date().toISOString(),
    };

    courses.push(newCourse);
    StorageService.set(StorageService.keys.COURSES, courses);
    return newCourse;
  }

  static addLearningUnit(courseId: string, unitData: { title: string; description: string; weekNumber?: number }): LearningUnit | null {
    this.init();
    const courses = this.getCourses();
    const courseIndex = courses.findIndex((c) => c.id === courseId);
    if (courseIndex === -1) return null;

    const course = courses[courseIndex];
    const weekNumber = unitData.weekNumber ?? (course.units.length + 1);

    const newUnit: LearningUnit = {
      id: `unit-${Date.now()}`,
      courseId,
      weekNumber,
      title: unitData.title,
      description: unitData.description,
      materials: [],
    };

    course.units.push(newUnit);
    courses[courseIndex] = course;
    StorageService.set(StorageService.keys.COURSES, courses);
    return newUnit;
  }

  static editLearningUnit(
    courseId: string,
    unitId: string,
    data: { title: string; description: string }
  ): boolean {
    this.init();
    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;

    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) return false;

    unit.title = data.title;
    unit.description = data.description;
    StorageService.set(StorageService.keys.COURSES, courses);
    return true;
  }

  static deleteLearningUnit(courseId: string, unitId: string): boolean {
    this.init();
    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;

    course.units = course.units.filter((u) => u.id !== unitId);
    StorageService.set(StorageService.keys.COURSES, courses);
    return true;
  }

  static validateMaterialFile(file: File): { isValid: boolean; error?: string; fileType?: 'pdf' | 'docx' | 'pptx' } {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!FILE_UPLOAD_LIMITS.ALLOWED_MATERIAL_EXTENSIONS.includes(ext as any)) {
      return {
        isValid: false,
        error: `סוג קובץ לא נתמך (${ext}). ניתן להעלות קבצים בפורמט PDF, DOCX, או PPTX בלבד.`,
      };
    }

    if (file.size > FILE_UPLOAD_LIMITS.MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: `גודל הקובץ חורג מהמגבלה של ${FILE_UPLOAD_LIMITS.MAX_FILE_SIZE_MB}MB.`,
      };
    }

    let fileType: 'pdf' | 'docx' | 'pptx' = 'pdf';
    if (ext === '.docx') fileType = 'docx';
    else if (ext === '.pptx') fileType = 'pptx';

    return { isValid: true, fileType };
  }

  static async uploadMaterial(
    courseId: string,
    unitId: string,
    params: {
      file: File;
      title: string;
      description?: string;
    },
    onProgress?: (percent: number) => void
  ): Promise<Material> {
    this.init();
    const validation = this.validateMaterialFile(params.file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Simulate upload progress
    const steps = FILE_UPLOAD_LIMITS.UPLOAD_SIMULATION_STEPS;
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, FILE_UPLOAD_LIMITS.UPLOAD_SIMULATION_STEP_DELAY_MS));
      if (onProgress) {
        onProgress(Math.round((i / steps) * 100));
      }
    }

    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) throw new Error('הקורס לא נמצא');

    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) throw new Error('יחידת הלימוד לא נמצאה');

    const sizeFormatted = (params.file.size / (1024 * 1024)).toFixed(1) + ' MB';

    const newMaterial: Material = {
      id: `mat-${Date.now()}`,
      unitId,
      courseId,
      title: params.title || params.file.name,
      description: params.description || '',
      fileType: validation.fileType || 'pdf',
      fileName: params.file.name,
      fileSize: sizeFormatted,
      uploadedAt: new Date().toISOString(),
      fileUrl: '#',
    };

    unit.materials.push(newMaterial);
    StorageService.set(StorageService.keys.COURSES, courses);
    return newMaterial;
  }

  static editMaterial(
    courseId: string,
    unitId: string,
    materialId: string,
    data: { title: string; description?: string }
  ): boolean {
    this.init();
    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;

    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) return false;

    const material = unit.materials.find((m) => m.id === materialId);
    if (!material) return false;

    material.title = data.title;
    if (data.description !== undefined) {
      material.description = data.description;
    }

    StorageService.set(StorageService.keys.COURSES, courses);
    return true;
  }

  static deleteMaterial(courseId: string, unitId: string, materialId: string): boolean {
    this.init();
    const courses = this.getCourses();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return false;

    const unit = course.units.find((u) => u.id === unitId);
    if (!unit) return false;

    unit.materials = unit.materials.filter((m) => m.id !== materialId);
    StorageService.set(StorageService.keys.COURSES, courses);
    return true;
  }
}
