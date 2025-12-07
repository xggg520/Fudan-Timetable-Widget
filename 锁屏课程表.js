// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: clock;
const REFRESH_INTERVAL = 5 * 60 * 1000;
async function createWidget() {
let widget = new ListWidget();
widget.refreshAfterDate = new Date(Date.now() + REFRESH_INTERVAL);
let gradient = new LinearGradient();
gradient.colors = [
new Color("#1a237e"),
new Color("#3949ab"),
new Color("#5c6bc0")
];
gradient.locations = [0, 0.5, 1];
widget.backgroundGradient = gradient;
widget.setPadding(8, 8, 8, 8);
try {
let timetableData = await loadTimetable();
let semesterStart = parseSemesterStart(timetableData);
let currentWeek = calculateCurrentWeek(semesterStart);
let courses = parseCourses(timetableData);
let now = new Date();
let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
let tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
let tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
let currentWeekCourses = courses.filter(course => course.week === currentWeek);
let nextWeekCourses = courses.filter(course => course.week === currentWeek + 1);
let currentCourse = findCurrentCourse(currentWeekCourses, now);
let todayEndCourses = currentWeekCourses.filter(course => course.dateStr === today && course.endTime < now);
let hasTodayCourses = currentWeekCourses.some(course => course.dateStr === today);
let nextCourse = findNextCourse(currentWeekCourses, now);
let tomorrowCourses = currentWeekCourses.filter(course => course.dateStr === tomorrowStr && course.startTime);
tomorrowCourses.sort((a, b) => a.startTime - b.startTime);
let nextWeekFirstCourse = nextWeekCourses.filter(course => course.startTime).sort((a, b) => a.startTime - b.startTime)[0];
const nameFontSize = 14;
const detailFontSize = 12;
if (nextCourse && nextCourse.dateStr === today) {
let title = widget.addText("下节课");
title.font = Font.mediumSystemFont(detailFontSize);
title.textColor = new Color("#2ecc71");
title.leftAlignText();
widget.addSpacer(2);
let name = widget.addText(nextCourse.name);
name.font = Font.boldSystemFont(nameFontSize);
name.textColor = Color.white();
name.lineLimit = 1;
name.minimumScaleFactor = 0.8;
let time = widget.addText(nextCourse.time);
time.font = Font.systemFont(detailFontSize);
time.textColor = new Color("#f39c12");
time.lineLimit = 1;
time.leftAlignText();
let location = widget.addText(`? ${nextCourse.location}`);
location.font = Font.systemFont(detailFontSize);
location.textColor = new Color("#9b59b6");
location.lineLimit = 1;
location.leftAlignText();
} else if (nextWeekFirstCourse) {
let title = widget.addText("下周课程");
title.font = Font.mediumSystemFont(detailFontSize);
title.textColor = new Color("#3498db");
title.leftAlignText();
widget.addSpacer(2);
let name = widget.addText(nextWeekFirstCourse.name);
name.font = Font.boldSystemFont(nameFontSize);
name.textColor = Color.white();
name.lineLimit = 1;
name.minimumScaleFactor = 0.8;
let time = widget.addText(nextWeekFirstCourse.time);
time.font = Font.systemFont(detailFontSize);
time.textColor = new Color("#f39c12");
time.lineLimit = 1;
time.leftAlignText();
let location = widget.addText(`? ${nextWeekFirstCourse.location}`);
location.font = Font.systemFont(detailFontSize);
location.textColor = new Color("#9b59b6");
location.lineLimit = 1;
location.leftAlignText();
} else {
let futureCourses = courses.filter(course => course.startTime && course.startTime > now);
futureCourses.sort((a, b) => a.startTime - b.startTime);
if (futureCourses.length > 0) {
let title = widget.addText("未来课程");
title.font = Font.mediumSystemFont(detailFontSize);
title.textColor = new Color("#9b59b6");
title.leftAlignText();
widget.addSpacer(2);
let name = widget.addText(futureCourses[0].name);
name.font = Font.boldSystemFont(nameFontSize);
name.textColor = Color.white();
name.lineLimit = 1;
name.minimumScaleFactor = 0.8;
let time = widget.addText(futureCourses[0].time);
time.font = Font.systemFont(detailFontSize);
time.textColor = new Color("#f39c12");
time.lineLimit = 1;
time.leftAlignText();
let location = widget.addText(`? ${futureCourses[0].location}`);
location.font = Font.systemFont(detailFontSize);
location.textColor = new Color("#9b59b6");
location.lineLimit = 1;
location.leftAlignText();
} else {
let noCourse = widget.addText("暂无下节课");
noCourse.font = Font.boldSystemFont(nameFontSize);
noCourse.textColor = Color.white();
noCourse.centerAlignText();
}
}
} catch (error) {
let errorText = widget.addText("加载失败");
errorText.font = Font.systemFont(12);
errorText.textColor = Color.red();
errorText.centerAlignText();
}
return widget;
}
async function loadTimetable() {
let fileManager = FileManager.iCloud();
let pathsToTry = [
fileManager.joinPath(fileManager.documentsDirectory(), "timetable"),
fileManager.joinPath("/", "timetable"),
fileManager.joinPath(fileManager.documentsDirectory(), "timetable.txt"),
"timetable",
"timetable.txt",
fileManager.joinPath(fileManager.documentsDirectory(), "timetable.txt.txt"),
"timetable.txt.txt"
];
for (let filePath of pathsToTry) {
try {
let exists = fileManager.fileExists(filePath);
if (exists) {
let content = await fileManager.readString(filePath);
return content;
}
} catch (error) {
}
}
throw new Error("未找到timetable文件");
}
function parseSemesterStart(timetableData) {
let cleanedData = timetableData.trim();
let regex = /Semester\s+start\s+date:\s*(\d{4}-\d{2}-\d{2})/i;
let match = cleanedData.match(regex);
if (match) {
let dateStr = match[1];
let date = new Date(dateStr);
return date;
} else {
return new Date("2025-09-08");
}
}
function calculateCurrentWeek(semesterStart) {
let now = new Date();
let diffTime = now - semesterStart;
let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
if (diffDays < 0) {
return 0;
} else {
return Math.floor(diffDays / 7) + 1;
}
}
function parseCourses(timetableData) {
let courses = [];
timetableData = timetableData.replace(/\r\n/g, '\n');
const courseBlockRegex = /========================================\r?\n([\d-]+)\s+[A-Za-z]+\r?\n========================================\r?\n((?:[\s\S]*?(?:Course Name:|No classes scheduled))[\s\S]*?)(?=\r?\n========================================|$)/g;
let match;
while ((match = courseBlockRegex.exec(timetableData)) !== null) {
let dateStr = match[1];
let courseContent = match[2];
if (courseContent.includes("No classes scheduled for this day")) {
continue;
}
let date = new Date(dateStr);
let lines = courseContent.split('\n');
let currentCourse = null;
for (let j = 0; j < lines.length; j++) {
let line = lines[j].trim();
if (line === '') {
continue;
}
if (line.startsWith('Course Name:')) {
if (currentCourse) {
courses.push(currentCourse);
}
currentCourse = {
date: date,
dateStr: dateStr,
startTime: new Date(date),
endTime: new Date(date)
};
currentCourse.name = line.replace('Course Name:', '').trim();
}
else if (currentCourse && line.startsWith('Time:')) {
currentCourse.time = line.replace('Time:', '').trim();
let timeMatch = currentCourse.time.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
if (timeMatch) {
let [__, startHour, startMinute, endHour, endMinute] = timeMatch;
currentCourse.startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
currentCourse.endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
}
}
else if (currentCourse && line.startsWith('Location:')) {
currentCourse.location = line.replace('Location:', '').trim();
}
else if (currentCourse && line.startsWith('Week:')) {
currentCourse.week = parseInt(line.replace('Week:', '').trim());
}
}
if (currentCourse) {
courses.push(currentCourse);
}
}
return courses;
}
function findCurrentCourse(courses, now) {
let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
for (let course of courses) {
let courseDateStr = course.dateStr;
if (!course.startTime || !course.endTime) {
continue;
}
if (courseDateStr === today && course.startTime <= now && course.endTime >= now) {
return course;
}
}
return null;
}
function findNextCourse(courses, now) {
let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
let nextCourses = [];
for (let course of courses) {
 let courseDateStr = course.dateStr;
 if (!course.startTime) {
 continue;
 }
 if (courseDateStr === today && course.startTime > now) {
 nextCourses.push(course);
 }
}
if (nextCourses.length > 0) {
 nextCourses.sort((a, b) => a.startTime - b.startTime);
 return nextCourses[0];
}
let futureCourses = [];
for (let course of courses) {
 if (!course.startTime) {
 continue;
 }
 if (course.startTime > now) {
 futureCourses.push(course);
 }
}
if (futureCourses.length === 0) {
 return null;
}
futureCourses.sort((a, b) => a.startTime - b.startTime);
return futureCourses[0];
}
async function main() {
if (config.runsInWidget) {
let widget = await createWidget();
Script.setWidget(widget);
} else {
let widget = await createWidget();
widget.presentMedium();
}
Script.complete();
}
main();