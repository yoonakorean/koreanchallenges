export class CourseStructure {
    constructor({ courseId, units = [] }) {
        this.courseId = courseId; // 例如: "Course_2A"
        this.units = units;
    }

    getUnit(unitId) {
        return this.units.find(u => u.id === unitId);
    }

    getLesson(unitId, lessonId) {
        const unit = this.getUnit(unitId);
        return unit?.lessons.find(l => l.id === lessonId);
    }
}
