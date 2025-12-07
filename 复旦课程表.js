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
  widget.setPadding(12, 12, 12, 12);
  try {
    let timetableData = await loadTimetable();
    console.log("=== 课表数据加载完成 ===");
    let semesterStart = parseSemesterStart(timetableData);
    let currentWeek = calculateCurrentWeek(semesterStart);
    console.log("学期开始日期:", semesterStart);
    console.log("当前周:", currentWeek);
    let courses = parseCourses(timetableData);
    console.log("解析到的课程总数:", courses.length);
    let now = new Date();
    console.log("当前时间:", now);
    let currentWeekCourses = courses.filter(course => course.week === currentWeek);
    console.log(`当前周: ${currentWeek}, 当前周课程数量: ${currentWeekCourses.length}`);
    let currentCourse = findCurrentCourse(currentWeekCourses, now);
    let nextCourse = findNextCourse(currentWeekCourses, now);
    console.log("当前课程:", currentCourse ? currentCourse.name : "无");
    console.log("下节课:", nextCourse ? nextCourse.name : "无");
    let futureCourses = courses.filter(course => course.startTime > now);
    console.log("未来课程总数:", futureCourses.length);
    if (futureCourses.length > 0) {
      console.log("未来第一节课:", futureCourses[0].name, futureCourses[0].dateStr, futureCourses[0].startTime);
    }
    const isSmallWidget = config.widgetFamily === "small";
    const isMediumWidget = config.widgetFamily === "medium";
    const isLargeWidget = config.widgetFamily === "large";
    const titleFontSize = isLargeWidget ? 20 : 14;
    const contentFontSize = isLargeWidget ? 16 : 12;
    const detailFontSize = isLargeWidget ? 14 : 10;
    let title = widget.addText("📚 课程表");
    title.font = Font.boldSystemFont(titleFontSize);
    title.textColor = Color.white();
    title.centerAlignText();
    title.lineLimit = 1;
    widget.addSpacer(isSmallWidget ? 6 : 8);
    let weekText = widget.addText(`当前：第${currentWeek}周`);
    weekText.font = Font.mediumSystemFont(contentFontSize);
    weekText.textColor = new Color("#3498db");
    weekText.centerAlignText();
    weekText.lineLimit = 1;
    widget.addSpacer(isSmallWidget ? 8 : 10);
    let currentTitle = widget.addText("当前课程");
    currentTitle.font = Font.mediumSystemFont(detailFontSize);
    currentTitle.textColor = new Color("#e74c3c");
    currentTitle.leftAlignText();
    if (currentCourse) {
      widget.addSpacer(2);
      addCourseInfo(widget, currentCourse, now, isSmallWidget);
    } else {
      let noCourse = widget.addText("当前无课程");
      noCourse.font = Font.systemFont(detailFontSize);
      noCourse.textColor = Color.gray();
      noCourse.leftAlignText();
    }
    widget.addSpacer(isSmallWidget ? 6 : 10);
    let nextTitle = widget.addText("下节课");
    nextTitle.font = Font.mediumSystemFont(detailFontSize);
    nextTitle.textColor = new Color("#2ecc71");
    nextTitle.leftAlignText();
    if (nextCourse) {
      widget.addSpacer(2);
      addCourseInfo(widget, nextCourse, now, isSmallWidget);
    } else {
      let nextWeek = currentWeek + 1;
      let nextWeekCourses = courses.filter(course => course.week === nextWeek && course.startTime > now);
      nextWeekCourses.sort((a, b) => a.startTime - b.startTime);
      let nextWeekFirstCourse = nextWeekCourses.length > 0 ? nextWeekCourses[0] : null;
      if (nextWeekFirstCourse) {
        nextTitle.text = "下周课程";
        nextTitle.textColor = new Color("#3498db");
        widget.addSpacer(2);
        addCourseInfo(widget, nextWeekFirstCourse, now, isSmallWidget);
      } else {
        let noNextCourse = widget.addText("无下节课");
        noNextCourse.font = Font.systemFont(detailFontSize);
        noNextCourse.textColor = Color.gray();
        noNextCourse.leftAlignText();
      }
    }
    widget.addSpacer();
  } catch (error) {
    let errorText = widget.addText("加载失败");
    errorText.font = Font.systemFont(12);
    errorText.textColor = Color.red();
    errorText.centerAlignText();
    let errorDetails = widget.addText(error.toString().substring(0, 50) + "...");
    errorDetails.font = Font.systemFont(10);
    errorDetails.textColor = Color.lightGray();
    errorDetails.centerAlignText();
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
      console.log("正在尝试路径:", filePath);
      let exists = fileManager.fileExists(filePath);
      console.log("文件是否存在:", exists);
      if (exists) {
        let content = await fileManager.readString(filePath);
        console.log("找到文件在路径:", filePath);
        console.log("文件内容长度:", content.length, "字符");
        console.log("文件内容前100字符:", content.substring(0, 100));
        return content;
      }
    } catch (error) {
      console.log("访问路径时出错:", filePath, "错误:", error);
    }
  }
  throw new Error("未找到timetable文件，请确保文件在iCloud云盘的Scriptable目录下");
}
function parseSemesterStart(timetableData) {
  console.log("=== 解析学期开始日期 ===");
  let cleanedData = timetableData.trim();
  let regex = /Semester\s+start\s+date:\s*(\d{4}-\d{2}-\d{2})/i;
  let match = cleanedData.match(regex);
  if (match) {
    let dateStr = match[1];
    let date = new Date(dateStr);
    console.log(`解析到学期开始日期: ${dateStr} -> ${date}`);
    return date;
  } else {
    console.log("无法解析学期开始日期，使用默认值2025-09-08");
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
  console.log("=== 开始解析课程数据 ===");
  console.log("timetableData类型:", typeof timetableData);
  console.log("timetableData长度:", timetableData.length);
  timetableData = timetableData.replace(/\r\n/g, '\n');
  let fileLines = timetableData.split('\n');
  console.log("文件前10行:");
  for (let i = 0; i < Math.min(10, fileLines.length); i++) {
    console.log(`第${i+1}行: '${fileLines[i]}'`);
  }
  console.log("\n=== 开始使用正则表达式解析 ===");
  const courseBlockRegex = /========================================\r?\n([\d-]+)\s+[A-Za-z]+\r?\n========================================\r?\n((?:[\s\S]*?(?:Course Name:|No classes scheduled))[\s\S]*?)(?=\r?\n========================================|$)/g;
  let match;
  let blockCount = 0;
  while ((match = courseBlockRegex.exec(timetableData)) !== null) {
    blockCount++;
    let dateStr = match[1];
    let courseContent = match[2];
    console.log(`\n处理课程块 ${blockCount}`);
    console.log(`日期: ${dateStr}`);
    console.log(`内容前100字符: ${courseContent.substring(0, 100)}`);
    if (courseContent.includes("No classes scheduled for this day")) {
      console.log("跳过无课程的日期");
      continue;
    }
    let date = new Date(dateStr);
    let lines = courseContent.split('\n');
    let courseCount = 0;
    let currentCourse = null;
    console.log("内容部分总行数:", lines.length);
    for (let j = 0; j < lines.length; j++) {
      let line = lines[j].trim();
      if (line === '') {
        continue;
      }
      if (line.startsWith('Course Name:')) {
        if (currentCourse) {
          courseCount++;
          courses.push(currentCourse);
          console.log(`解析完成课程 ${courseCount}: ${currentCourse.name}, 周次: ${currentCourse.week}`);
        }
        currentCourse = {
          date: date,
          dateStr: dateStr,
          startTime: new Date(date),
          endTime: new Date(date)
        };
        currentCourse.name = line.replace('Course Name:', '').trim();
        console.log(`找到新课程: ${currentCourse.name}`);
      }
      else if (currentCourse && line.startsWith('Time:')) {
        currentCourse.time = line.replace('Time:', '').trim();
        console.log(`课程时间: ${currentCourse.time}`);
 let timeMatch = currentCourse.time.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          let [__, startHour, startMinute, endHour, endMinute] = timeMatch;
          currentCourse.startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
          currentCourse.endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
        }
      }
      else if (currentCourse && line.startsWith('Location:')) {
        currentCourse.location = line.replace('Location:', '').trim();
        console.log(`课程地点: ${currentCourse.location}`);
      }
      else if (currentCourse && line.startsWith('Teacher:')) {
        currentCourse.teacher = line.replace('Teacher:', '').trim();
        console.log(`课程教师: ${currentCourse.teacher}`);
      }
      else if (currentCourse && line.startsWith('Week:')) {
        currentCourse.week = parseInt(line.replace('Week:', '').trim());
        console.log(`课程周次: ${currentCourse.week}`);
      }
    }
    if (currentCourse) {
      courseCount++;
      courses.push(currentCourse);
      console.log(`解析完成课程 ${courseCount}: ${currentCourse.name}, 周次: ${currentCourse.week}`);
    }
    console.log(`该日期块包含${courseCount}门课程`);
  }
  console.log("\n=== 解析结果验证 ===");
  console.log(`总共解析到${courses.length}门课程`);
  if (courses.length > 0) {
    console.log("前5门课程:");
    for (let i = 0; i < Math.min(5, courses.length); i++) {
      console.log(`课程 ${i+1}: ${courses[i].name}, 日期: ${courses[i].dateStr}, 周次: ${courses[i].week}`);
    }
    let dec4Courses = courses.filter(course => course.dateStr === "2025-12-04");
    console.log(`2025-12-04的课程数量: ${dec4Courses.length}`);
    dec4Courses.forEach(course => {
      console.log(`12月4日课程: ${course.name}, 周次: ${course.week}`);
    });
  }
  return courses;
}
function findCurrentCourse(courses, now) {
  let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  console.log("查找当前课程 - 今天日期:", today);
  for (let course of courses) {
    let courseDateStr = course.dateStr;
    let courseWeek = course.week;
    if (!course.startTime || !course.endTime) {
      console.log(`跳过课程: ${course.name} - 缺少时间信息`);
      continue;
    }
    console.log(`检查课程: ${course.name}, 日期: ${courseDateStr}, 周次: ${courseWeek}, 开始时间: ${course.startTime}, 当前时间: ${now}`);
    if (courseDateStr === today && course.startTime <= now && course.endTime >= now) {
      console.log("找到当前课程:", course.name);
      return course;
    }
  }
  console.log("未找到当前课程");
  return null;
}
function findNextCourse(courses, now) {
  let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  let tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  let currentWeek = calculateCurrentWeek(new Date("2025-09-08"));
  let nextWeek = currentWeek + 1;
  console.log("查找下节课 - 今天:", today, "明天:", tomorrowStr, "当前周:", currentWeek, "下周:", nextWeek);
  let nextCourses = [];
  for (let course of courses) {
    let courseDateStr = course.dateStr;
    if (!course.startTime) {
      console.log(`跳过课程: ${course.name} - 缺少开始时间`);
      continue;
    }
    if (courseDateStr === today && course.startTime > now) {
      nextCourses.push(course);
      console.log("今天的下节课候选:", course.name, course.startTime);
    }
  }
  if (nextCourses.length > 0) {
    nextCourses.sort((a, b) => a.startTime - b.startTime);
    console.log("返回今天的下节课:", nextCourses[0].name);
    return nextCourses[0];
  }
  let tomorrowCourses = [];
  for (let course of courses) {
    if (!course.startTime) {
      console.log(`跳过课程: ${course.name} - 缺少开始时间`);
      continue;
    }
    let courseDateStr = course.dateStr;
    if (courseDateStr === tomorrowStr && course.startTime > now) {
      tomorrowCourses.push(course);
      console.log("明天的课程候选:", course.name, course.startTime);
    }
  }
  if (tomorrowCourses.length > 0) {
    tomorrowCourses.sort((a, b) => a.startTime - b.startTime);
    console.log("返回明天的下节课:", tomorrowCourses[0].name);
    return tomorrowCourses[0];
  }
  let currentWeekRemainingCourses = courses.filter(course => {
    if (!course.startTime) return false;
    return course.week === currentWeek && course.startTime > now;
  });
  currentWeekRemainingCourses.sort((a, b) => a.startTime - b.startTime);
  if (currentWeekRemainingCourses.length > 0) {
    console.log("返回本周剩余课程:", currentWeekRemainingCourses[0].name);
    return currentWeekRemainingCourses[0];
  }
  let nextWeekCourses = courses.filter(course => {
    return course.week === nextWeek;
  });
  nextWeekCourses.sort((a, b) => a.startTime - b.startTime);
  if (nextWeekCourses.length > 0) {
    console.log("返回下周第一节课:", nextWeekCourses[0].name);
    return nextWeekCourses[0];
  }
  let futureCourses = [];
  for (let course of courses) {
    if (!course.startTime) {
      console.log(`跳过课程: ${course.name} - 缺少开始时间`);
      continue;
    }
    if (course.startTime > now) {
      futureCourses.push(course);
      console.log("未来课程候选:", course.name, course.dateStr, course.startTime);
    }
  }
  if (futureCourses.length === 0) {
    console.log("未找到未来课程");
    return null;
  }
  futureCourses.sort((a, b) => a.startTime - b.startTime);
  console.log("返回未来第一节课:", futureCourses[0].name);
  return futureCourses[0];
}
function addCourseInfo(widget, course, now, isSmallWidget) {
  const isLargeWidget = config.widgetFamily === "large";
  const nameFontSize = isLargeWidget ? 16 : 12;
  const detailFontSize = isLargeWidget ? 14 : 10;
  let name = widget.addText(course.name);
  name.font = Font.boldSystemFont(nameFontSize);
  name.textColor = Color.white();
  name.lineLimit = 1;
  name.minimumScaleFactor = 0.8;
  let today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let datePrefix = today === course.dateStr ? "" : `${getWeekday(course.date)} `;
  let time = widget.addText(`${datePrefix}${course.time}`);
  time.font = Font.systemFont(detailFontSize);
  time.textColor = new Color("#f39c12");
  time.lineLimit = 1;
  time.leftAlignText();
  let location = widget.addText(`📍 ${course.location}`);
  location.font = Font.systemFont(detailFontSize);
  location.textColor = new Color("#9b59b6");
  location.lineLimit = 1;
  location.leftAlignText();
  if (isLargeWidget && course.teacher) {
    let teacher = widget.addText(`👨‍🏫 ${course.teacher}`);
    teacher.font = Font.systemFont(detailFontSize);
    teacher.textColor = new Color("#e67e22");
    teacher.lineLimit = 1;
    teacher.leftAlignText();
  }
}
async function debugFileAccess() {
  console.log("=== 文件访问调试 ===");
  let fileManager = FileManager.iCloud();
  let docDir = fileManager.documentsDirectory();
  console.log("documentsDirectory路径:", docDir);
  console.log("\ndocumentsDirectory中的文件:");
  let files = fileManager.listContents(docDir);
  for (let file of files) {
    let fullPath = fileManager.joinPath(docDir, file);
    let isDirectory = fileManager.isDirectory(fullPath);
    console.log(`${file} ${isDirectory ? "(目录)" : "(文件)"}`);
    if (!isDirectory && (file === "timetable" || file === "timetable.txt")) {
      try {
        let content = await fileManager.readString(fullPath);
        console.log(`  - ${file} 可读取，内容长度: ${content.length} 字符`);
      } catch (error) {
        console.log(`  - ${file} 读取失败:`, error);
      }
    }
  }
  try {
    console.log("\n=== 开始尝试加载文件 ===");
    let content = await loadTimetable();
    console.log("\n=== 文件加载成功 ===");
    console.log("文件内容预览:", content.substring(0, 200) + "...");
  } catch (error) {
    console.log("\n=== 加载文件时出错 ===");
    console.log("错误信息:", error);
  }
}
async function main() {
  if (!config.runsInWidget) {
    await debugFileAccess();
  }
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
function formatTime(date) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
function getWeekday(date) {
  let weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return weekdays[date.getDay()];
}
