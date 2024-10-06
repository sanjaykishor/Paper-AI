// DOM elements
const searchStudentBtn = document.getElementById("searchStudentBtn");
const searchClassExamBtn = document.getElementById("searchClassExamBtn");
const startEvaluationBtn = document.getElementById("startBtn");

const popupInterval = 8000;

searchStudentBtn.addEventListener("click", () => {
  console.log("search student clicked");
  const studentId = document.getElementById("studentIdInput").value;
  if (studentId) {
    window.electronAPI.send("search-student", {
      channel: "search-student",
      data: {
        studentId,
      },
    });
  } else {
    showPopup("Please enter a valid Student ID", true);
  }
});

searchClassExamBtn.addEventListener("click", () => {
  console.log("search class exam clicked");
  const className = document.getElementById("classInput").value;
  const examType = document.getElementById("examTypeInput").value;
  if (className && examType) {
    window.electronAPI.send("search-class-exam", {
      channel: "search-class-exam",
      data: { className, examType },
    });
  } else {
    showPopup("Please enter a valid Class and Exam Type", true);
  }
});

startEvaluationBtn.addEventListener("click", () => {
  console.log("start evaluation clicked");
  const keyPath = document.getElementById("keyPathInput").value;
  const paperPath = document.getElementById("paperPathInput").value;
  if (keyPath && paperPath) {
    window.electronAPI.send("start-evaluation", {
      channel: "start-evaluation",
      data: {
        keyPath,
        paperPath,
      },
    });
  } else {
    showPopup("Please select both key path and paper path!", true);
  }
});

function showPopup(message, isError) {
  const popup = document.getElementById("popup");
  popup.textContent = message;
  popup.className = "popup " + (isError ? "error" : "success");
  popup.style.display = "block";
  setTimeout(() => {
    popup.style.display = "none";
  }, popupInterval);
}

window.electronAPI.receive((data) => {
  console.log(data);
  switch (data.channel) {
      case "evaluation-results":
          displayEvaluationResults(data.data);
          break;
  }
});

function displayEvaluationResults(results) {
  const resultsContainer = document.getElementById('resultsContainer');
  const marksTableBody = document.getElementById('marksTable').getElementsByTagName('tbody')[0];
  
  resultsContainer.innerHTML = ''; // Clear previous results
  marksTableBody.innerHTML = ''; // Clear previous marks data

  results.forEach(result => {
      // Add to detailed results
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      resultItem.innerHTML = `
          <h4>Roll No: ${result.rollNo}</h4>
          <p>Total Score: <span class="score">${result.totalScore}</span></p>
          <p>Max Possible Score: ${result.maxPossibleScore}</p>
          <p>Is Complete: ${result.isComplete ? 'Yes' : 'No'}</p>
      `;
      resultsContainer.appendChild(resultItem);

      // Add to marks table
      const row = marksTableBody.insertRow();
      row.insertCell(0).textContent = result.rollNo;
      row.insertCell(1).textContent = result.totalScore;
      row.insertCell(2).textContent = result.maxPossibleScore;
  });

  showPopup("Evaluation completed successfully!", false);
}

// Search for student
// function searchStudent() {
//   const studentId = document.getElementById("studentId").value;
//   if (studentId) {
//     window.electronAPI.send("search-student", studentId);
//   } else {
//     alert("Please enter a valid Student ID");
//   }
// }

// Search for exam type
// function searchExam() {
//   const examType = document.getElementById("examType").value;
//   if (examType) {
//     window.electronAPI.send("search-exam", examType);
//   } else {
//     alert("Please enter a valid Exam Type");
//   }
// }

// Search for class
// function searchClass() {
//   const className = document.getElementById("class").value;
//   if (className) {
//     window.electronAPI.send("search-class", className);
//   } else {
//     alert("Please enter a valid Class");
//   }
// }

// Start evaluation process
// function startEvaluation() {
//   const keyPath = document.getElementById("keyPath").files[0];
//   const paperPath = document.getElementById("paperPath").files[0];

//   if (keyPath && paperPath) {
//     window.electronAPI.send("start-evaluation", {
//       keyPath: keyPath.path,
//       paperPath: paperPath.path,
//     });
//   } else {
//     alert("Please select both key path and paper path!");
//   }
// }

// Populate student info
// function populateStudentInfo(studentId, className, year, exam) {
//   const studentInfo = document.getElementById("student-info");
//   studentInfo.innerHTML = `
//         <p>Student Id: ${studentId}</p>
//         <p>Class: ${className}</p>
//         <p>Year: ${year}</p>
//         <p>Exam: ${exam}</p>
//     `;
// }

// Load marks data into the table
// function loadMarksData(marks) {
//   const marksTable = document
//     .getElementById("marksTable")
//     .getElementsByTagName("tbody")[0];
//   marksTable.innerHTML = ""; // Clear any existing data

//   marks.forEach((item) => {
//     const row = marksTable.insertRow();
//     row.insertCell(0).innerText = item.test;
//     row.insertCell(1).innerText = item.subject;
//     row.insertCell(2).innerText = item.marksObtained;
//     row.insertCell(3).innerText = item.totalMarks;
//   });
// }

// document
//   .getElementById("searchStudentBtn")
//   .addEventListener("click", function () {
//     // Fetch the values from the inputs (These will typically come from a backend)
//     const studentId =
//       document.getElementById("studentIdInput").value || "1234567";
//     const classValue = document.getElementById("classInput").value || "12th";
//     const examValue = document.getElementById("examTypeInput").value || "Unit";
//     const yearValue = "2021"; // This can also be fetched dynamically

//     // Update the dynamic content placeholders with the fetched values
//     document.getElementById("studentIdValue").innerText = studentId;
//     document.getElementById("classValue").innerText = classValue;
//     document.getElementById("examValue").innerText = examValue;
//     document.getElementById("yearValue").innerText = yearValue;
//   });

// Render the pie chart with marks data
// function renderChart(data, labels) {
//     const ctx = document.getElementById('marksChart').getContext('2d');
//     const chart = new Chart(ctx, {
//         type: 'pie',
//         data: {
//             labels: labels,
//             datasets: [{
//                 label: 'Marks Distribution',
//                 data: data,
//                 backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
//                 hoverOffset: 4
//             }]
//         }
//     });
// }

// // Add event listeners to buttons
// document.addEventListener('DOMContentLoaded', function () {
//     // Request initial data from the main process
//     window.electronAPI.send('load-initial-data');

//     // Set up button click listeners
//     searchStudentBtn.addEventListener('click', searchStudent);
//     // searchExamBtn.addEventListener('click', searchExam);
//     searchClassBtn.addEventListener('click', searchClass);
//     startEvaluationBtn.addEventListener('click', startEvaluation);
// });

// Listen for data from the main process
// window.electronAPI.on('student-data', (event, data) => {
//     populateStudentInfo(data.studentId, data.class, data.year, data.exam);
//     loadMarksData(data.marks);
//     renderChart(data.marksChartData, data.marksChartLabels);
// });



