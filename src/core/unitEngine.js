import { STAGES } from '../config/constants.js';

export class UnitEngine {
    constructor(courseData = []) {
        this.courses = courseData;
    }

    getCourse(courseId) {
        return this.courses.find(c => c.id === courseId);
    }

    getUnit(courseId, unitId) {
        const course = this.getCourse(courseId);
        return course?.units.find(u => u.id === unitId);
    }

    getLesson(courseId, unitId, lessonId) {
        const unit = this.getUnit(courseId, unitId);
        return unit?.lessons.find(l => l.id === lessonId);
    }
}

// 範例課程樹狀層級資料結構
export const DEFAULT_COURSE_DATA = [
    {
        id: "Course_2A",
        units: [
            {
                id: "Unit_1",
                lessons: [
                    {
                        id: "Lesson_A",
                        title: "基礎對話",
                        stageFlow: [STAGES.VOCAB, STAGES.SENTENCE, STAGES.SPEECH] // Lesson A 包含 1~3 關
                    },
                    {
                        id: "Lesson_B",
                        title: "單字複習關",
                        stageFlow: [STAGES.VOCAB, STAGES.SENTENCE] // Lesson B 只包含 1~2 關
                    }
                ]
            }
        ]
    }
];
