# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import subprocess
from urllib.parse import urlparse, parse_qs
import base64
import json
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from datetime import datetime, timedelta

with open("userInfo.json", "r") as f:
    file = json.load(f)
    username = file["username"]
    password = file["password"]

session = requests.session()

def calculate_current_week(start_date_str):
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    today = datetime.now().date()
    days_diff = (today - start_date).days
    if days_diff < 0:
        return 0
    else:
        return (days_diff // 7) + 1

def jsencrypt_like_encrypt(e: str, t: str) -> str:
    if "BEGIN PUBLIC KEY" in t:
        pem = t
    else:
        s = "".join(t.strip().split())
        pem = "-----BEGIN PUBLIC KEY-----\n" + "\n".join(s[i:i+64] for i in range(0, len(s), 64)) + "\n-----END PUBLIC KEY-----\n"
    pub = serialization.load_pem_public_key(pem.encode("utf-8"))
    data = e.encode("utf-8")
    ct = pub.encrypt(data, padding.PKCS1v15())
    return base64.b64encode(ct).decode("utf-8")

def get_session():
    url = "https://id.fudan.edu.cn/idp/authCenter/authenticate?service=https%3A%2F%2Ffdjwgl.fudan.edu.cn%2Fstudent%2Fsso%2Flogin"
    try:
        result = subprocess.run(
            ["curl", "-s", "-D", "-", "-o", "NUL", url],
            capture_output=True,
            text=True
        )
    except Exception as e:
        print(f"Failed to get redirect link: {e}")
        return None

    location = None
    for line in result.stdout.splitlines():
        if line.lower().startswith("location:"):
            location = line.split(":", 1)[1].strip()
            break
    
    if not location:
        print("Redirect link not found")
        return None
    
    parsed = urlparse(location)
    fragment_part = parsed.fragment.split("?", 1)[-1]
    params = parse_qs(fragment_part)
    lck_value = params.get("lck", [None])[0]
    
    if not lck_value:
        print("lck parameter not found")
        return None
    
    try:
        res = session.get("https://id.fudan.edu.cn/idp/authn/getJsPublicKey")
        key = res.json()["data"]
    except Exception as e:
        print(f"Failed to get public key: {e}")
        return None
    
    encrypted_password = jsencrypt_like_encrypt(password, key)
    
    headers = {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/json;charset=UTF-8',
        'origin': 'https://id.fudan.edu.cn',
        'referer': f"https://id.fudan.edu.cn/idp/authCenter/authenticate?service=https%3A%2F%2Ffdjwgl.fudan.edu.cn%2Fstudent%2Fsso%2Flogin",
    }

    json_data = {
        'authModuleCode': 'userAndPwd',
        'authChainCode': '4cffafe714ad48eeb574714771147063',
        'entityId': 'https://fdjwgl.fudan.edu.cn',
        'requestType': 'chain_type',
        'lck': lck_value,
        'authPara': {
            'loginName': username,
            'password': encrypted_password,
            'verifyCode': '',
        },
    }

    try:
        response = session.post('https://id.fudan.edu.cn/idp/authn/authExecute', headers=headers, json=json_data)
        data = response.json()
        if "loginToken" not in data:
            print(f"Login failed: {data}")
            return None
        
        token = data["loginToken"]
        
        res = session.post("https://id.fudan.edu.cn/idp/authCenter/authnEngine?locale=zh-CN", data={"loginToken": token})
        html = res.text
        soup = BeautifulSoup(html, "html.parser")
        ticket_input = soup.find("input", {"id": "ticket"})
        
        if not ticket_input:
            print("Ticket not found")
            return None
            
        ticket = ticket_input["value"]
        
        params = {
            'ticket': ticket,
            "refer": "https://fdjwgl.fudan.edu.cn/student/for-std/course-table"
        }
        
        res = session.get("https://fdjwgl.fudan.edu.cn/student/sso/login?", 
                          allow_redirects=False, 
                          params=params,
                          headers={'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'})
        
        return dict(res.cookies)
    
    except Exception as e:
        print(f"Error during login process: {e}")
        return None

def weeks_json(start_str, end_str, start_on_sunday=False):
    start = datetime.strptime(start_str, "%Y-%m-%d").date()
    end = datetime.strptime(end_str, "%Y-%m-%d").date()
    if start > end:
        return {}
    
    out, i, cur = {}, 1, start
    while cur <= end:
        week = []
        for k in range(7):
            d = cur + timedelta(days=k)
            if d > end:
                break
            week.append(d.isoformat())
        out[str(i)] = week
        i += 1
        cur += timedelta(days=7)
    
    if start_on_sunday:
        for week_num in out:
            out[week_num] = out[week_num][1:] + out[week_num][:1]
    
    return out

def save_timetable_to_text(courses, start_date, current_week, filename="timetable"):
    # 不再需要特殊标记，保持格式一致
    date_to_courses = {}
    for course in courses:
        date_str = course[2]
        if date_str not in date_to_courses:
            date_to_courses[date_str] = []
        date_to_courses[date_str].append(course)
    
    all_dates = set(date_to_courses.keys())
    if all_dates:
        min_date = datetime.strptime(min(all_dates), "%Y-%m-%d")
        max_date = datetime.strptime(max(all_dates), "%Y-%m-%d")
        current_date = min_date
        while current_date <= max_date:
            date_str = current_date.strftime("%Y-%m-%d")
            if date_str not in all_dates:
                all_dates.add(date_str)
            current_date += timedelta(days=1)
    
    sorted_dates = sorted(all_dates)
    
    with open(filename, "w", encoding="utf-8") as f:
        # 移除所有特殊标记，保持与本学期课表相同的标准格式
        f.write("\n===== Fudan University Student Timetable =====\n\n")
        f.write(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Semester start date: {start_date}\n")
        f.write(f"Current week: {current_week}\n\n")
        
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        
        for date_str in sorted_dates:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            weekday = weekdays[date_obj.weekday()]
            
            f.write(f"\n{'='*40}\n")
            f.write(f"{date_str} {weekday}\n")
            f.write(f"{'='*40}\n")
            
            if date_str in date_to_courses and date_to_courses[date_str]:
                def sort_by_time(course):
                    try:
                        return datetime.strptime(course[3], "%H:%M")
                    except ValueError:
                        return datetime.strptime("23:59", "%H:%M")
                
                day_courses = sorted(date_to_courses[date_str], key=sort_by_time)
                
                for course in day_courses:
                    course_name, location, _, start_time, end_time, teacher, week_num = course
                    
                    f.write(f"Course Name: {course_name}\n")
                    f.write(f"Time: {start_time} - {end_time}\n")
                    f.write(f"Location: {location}\n")
                    f.write(f"Teacher: {teacher}\n")
                    f.write(f"Week: {week_num}\n\n")
            else:
                f.write("No classes scheduled for this day\n\n")
        
        f.write("\n===== End of Timetable =====\n")
    
    print(f"Timetable saved to {filename}")

def main():
    print("Logging into Fudan University Educational Administration System...")
    token = get_session()
    
    if not token or "SESSION" not in token:
        print("Login failed, please check username and password")
        return
    
    print("Login successful, retrieving timetable information...")
    
    cookies = {
        'SESSION': token["SESSION"],
    }
    if "__pstsid__" in token:
        cookies['__pstsid__'] = token["__pstsid__"]
    
    try:
        main_url = "https://fdjwgl.fudan.edu.cn/student/for-std/course-table"
        res = requests.get(main_url, cookies=cookies)
        
        semester_data = None
        
        import re
        m = re.search(r"var\s+semesters\s*=\s*JSON\.parse\(\s*'(?P<j>.*?)'\s*\)", res.text, re.S)
        if m:
            try:
                json_str = re.sub(r'\\"', '"', m.group(1))
                semester_data = json.loads(json_str)
            except Exception as e:
                print(f"Error parsing semester data with method 1: {e}")
        
        if not semester_data:
            m = re.search(r"var\s+semesters\s*=\s*(\[.*?\]);", res.text, re.S)
            if m:
                try:
                    semester_data = json.loads(m.group(1))
                except Exception as e:
                    print(f"Error parsing semester data with method 2: {e}")
        
        current_week = None
        start_date = None
        end_date = None
        sid = None
        start_on_sunday = False
        # Initialize target_semester_index with default value to avoid variable scope issues
        target_semester_index = 0
        
        if semester_data and isinstance(semester_data, list):
            try:
                # Try to get next semester (second element in the list), use current semester if not available
                target_semester_index = 1 if len(semester_data) > 1 else 0
                if target_semester_index == 1 and len(semester_data) > 1:
                    print("\n===== Retrieving NEXT SEMESTER timetable =====\n")
                    try:
                        current_semester = semester_data[target_semester_index]
                        print("Successfully retrieved next semester data")
                    except (IndexError, TypeError) as e:
                        print(f"Failed to retrieve next semester data: {e}, switching to current semester")
                        current_semester = semester_data[0]
                        target_semester_index = 0
                else:
                    current_semester = semester_data[0]
                    print("Multiple semester data not found, using current semester")
                
                # Safely retrieve semester information
                try:
                    sid = current_semester.get('id', '504')
                    start_date = current_semester.get('startDate')
                    end_date = current_semester.get('endDate')
                    start_on_sunday = current_semester.get('weekStartOnSunday', False)
                    
                    print(f"Successfully retrieved semester information from website:")
                    print(f"Semester ID: {sid}")
                    print(f"Semester start date: {start_date}")
                    print(f"Semester end date: {end_date}")
                    print(f"Week starts on Sunday: {start_on_sunday}")
                    
                    # If next semester is selected, explicitly inform user
                    if target_semester_index == 1:
                        print("Note: This is the next semester's timetable.")
                except Exception as e:
                    print(f"Error parsing semester information: {e}, using default values")
                    # Use default values to ensure program can continue running
                    sid = "504"
                    start_date = "2026-03-02"
                    end_date = None
                    start_on_sunday = False
            except Exception as e:
                print(f"Error processing semester data: {e}, using default settings")
                # Use default values when completely failed
                sid = "504"
                start_date = "2026-03-02"
                end_date = None
                start_on_sunday = False
                target_semester_index = 0
        else:
            print("Warning: Could not retrieve semester list data. Using default settings.")
            soup = BeautifulSoup(res.text, 'html.parser')
            
            possible_week_elements = soup.select('.current-week, .week-info, .week-number, .currentWeek')
            possible_date_elements = soup.select('.semester-start-date, .start-date, .semester-info, .date-info')
            
            for element in possible_week_elements:
                text = element.get_text(strip=True)
                week_match = re.search(r'\d+', text)
                if week_match:
                    current_week = int(week_match.group(1))
                    print(f"Found current week from HTML: {current_week}")
                    break
            
            for element in possible_date_elements:
                text = element.get_text(strip=True)
                date_match = re.search(r'(\d{4})[^\d]*(\d{1,2})[^\d]*(\d{1,2})', text)
                if date_match:
                    start_date = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
                    print(f"Found semester start date from HTML: {start_date}")
                    break
            
            if not start_date:
                print("Warning: Could not retrieve semester start date from website")
                start_date = "2026-03-02"
                print(f"Using default semester start date: {start_date}")
            
            if not end_date:
                semester_weeks = 20
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
                end_date = (start_date_obj + timedelta(weeks=semester_weeks)).strftime("%Y-%m-%d")
                print(f"Calculated semester end date: {end_date}")
            
            # 修改默认学期ID为下学期的值（假设504是当前学期，505可能是下学期）
            # 同时将默认行为设置为尝试获取下学期课表
            is_next_semester_mode = True  # 默认尝试获取下学期课表
            if not sid:
                if is_next_semester_mode:
                    sid = "505"  # 尝试使用下学期ID
                    print(f"Using default NEXT SEMESTER ID: {sid}")
                else:
                    sid = "504"  # 当前学期ID
                    print(f"Using default CURRENT SEMESTER ID: {sid}")
        
        if not current_week and start_date:
            current_week = calculate_current_week(start_date)
            print(f"Calculated current week: {current_week}")
        
        if not current_week:
            current_week = 1
            print(f"Using default current week: {current_week}")
        
        print(f"Generating week information...")
        week_info = weeks_json(start_date, end_date, start_on_sunday)
        
        params = {
            'semesterId': sid,
            'hasExperiment': 'true',
        }
        
        response = requests.get(
            f'https://fdjwgl.fudan.edu.cn/student/for-std/course-table/semester/{sid}/print-data',
            params=params,
            cookies=cookies,
        )
        
        data = response.json()
        
        courses = []
        if "studentTableVms" in data and data["studentTableVms"]:
            for activity in data["studentTableVms"][0]["activities"]:
                start_time = activity["startTime"]
                end_time = activity["endTime"]
                day_index = int(activity["weekday"]) - 1
                course_name = activity["courseName"]
                location = activity["room"] or "Location to be determined"
                weeks = activity["weekIndexes"]
                
                teacher = activity.get("teacherName") or activity.get("teacher") or activity.get("teacherNames") or \
                          activity.get("instructor") or activity.get("instructorName") or activity.get("teacherInfo") or \
                          activity.get("teachers") or "Teacher to be determined"
                
                if isinstance(teacher, list):
                    teacher = ", ".join(str(t) for t in teacher) if teacher else "Teacher to be determined"
                elif isinstance(teacher, dict):
                    teacher = teacher.get("name") or teacher.get("teacherName") or teacher.get("displayName") or \
                              str(teacher) or "Teacher to be determined"
                
                if not teacher or teacher.strip() in ["", "null", "undefined"]:
                    teacher = "Teacher to be determined"
                for week_num in weeks:
                    if str(week_num) in week_info and day_index < len(week_info[str(week_num)]):
                        date = week_info[str(week_num)][day_index]
                        courses.append([course_name, location, date, start_time, end_time, teacher, week_num])
        
        if not courses:
            print("Course data not found or empty")
            return
        
        # Before saving timetable, select appropriate filename based on whether it's next semester
        is_next_semester_timetable = False
        
        # Check if we're using next semester via direct index selection
        if target_semester_index == 1 and semester_data and len(semester_data) > 1:
            is_next_semester_timetable = True
        # Check if we're using next semester via default ID
        elif semester_data is None or not isinstance(semester_data, list) and sid == "505":
            is_next_semester_timetable = True
        
        if is_next_semester_timetable:
            filename = "timetable_next_semester"
            print(f"Retrieved {len(courses)} classes for next semester")
        else:
            filename = "timetable"
            print(f"Retrieved {len(courses)} classes")

        save_timetable_to_text(courses, start_date, current_week, filename)
    
    except Exception as e:
        print(f"Error during timetable retrieval: {e}")

if __name__ == "__main__":
    main()