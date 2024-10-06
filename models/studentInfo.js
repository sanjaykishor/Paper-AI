class studentInfo {
  constructor() {
    this.studentName = "";
    this.studentAge = 0;
    this.studentGender = "";
    this.studentGrade = "";
    this.studentId = "";
  }

  setStudentName = (name) => {
    this.studentName = name;
  };

  setStudentAge = (age) => {
    this.studentAge = age;
  };

  setStudentId = (id) => {
    this.studentId = id;
  };

  getStudentId = () => {
    return this.studentId;
  };
}

module.exports = new studentInfo();
